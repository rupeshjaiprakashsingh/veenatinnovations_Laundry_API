import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { OrderRepository, ServiceRepository, CustomerRepository, BranchRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto, UpdatePaymentStatusDto, AssignShopDto, BulkAssignShopDto, CreateTimeSlotDto, UpdateTimeSlotDto } from './dto/order.dto';
import { NotificationSenderService } from '../notification/notification-sender.service';

@Injectable()
export class OrderService implements OnModuleInit {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly branchRepository: BranchRepository,
    private readonly prisma: PrismaService,
    private readonly notificationSender: NotificationSenderService,
  ) {}

  /**
   * Calculates delivery charge:
   * - If clothes < 10 and orderValue > 300: 0 (Free delivery)
   * - If clothes < 10 and orderValue <= 300: 30 (Standard charge)
   * - If clothes >= 10: 0 (Free delivery)
   */
  public static calculateDeliveryCharge(clothesCount: number, orderValue: number): number {
    const minClothes = parseInt(process.env.DELIVERY_FREE_MIN_CLOTHES || '10', 10);
    const minOrderValue = parseFloat(process.env.DELIVERY_FREE_MIN_ORDER_VALUE || '300');
    const standardFee = parseFloat(process.env.DELIVERY_STANDARD_FEE || '30');

    if (clothesCount < minClothes) {
      if (orderValue > minOrderValue) {
        return 0.0; // Free delivery for high-value small orders (> ₹300)
      } else {
        return standardFee; // Standard charge for small, low-value orders (<= ₹300)
      }
    } else {
      return 0.0; // Free delivery for 10 or more clothes
    }
  }

  public static evaluateRuleCondition(
    clothesCount: number,
    orderValue: number,
    conditionClothes: string,
    conditionValue: string,
  ): boolean {
    const parseCondition = (val: number, cond: string): boolean => {
      const c = (cond || '').trim().toUpperCase();
      if (c === 'ANY' || c === '' || c === '*') return true;
      if (c.startsWith('<=')) return val <= parseFloat(c.replace('<=', '').trim());
      if (c.startsWith('>=')) return val >= parseFloat(c.replace('>=', '').trim());
      if (c.startsWith('<')) return val < parseFloat(c.replace('<', '').trim());
      if (c.startsWith('>')) return val > parseFloat(c.replace('>', '').trim());
      if (c.startsWith('=')) return val === parseFloat(c.replace('=', '').trim());
      return false;
    };

    return parseCondition(clothesCount, conditionClothes) && parseCondition(orderValue, conditionValue);
  }

  /**
   * Option 2: Bundled GST Billing
   * Combines all components into one "service package" (Laundry + Platform Fee + Delivery Fee)
   * before applying GST (default 18%).
   */
  public static calculateBundledGst(
    subtotal: number,
    platformFee: number,
    deliveryFee: number,
    gstRatePercent: number = 18,
  ): { taxableBase: number; taxAmount: number } {
    const taxableBase = parseFloat((subtotal + platformFee + deliveryFee).toFixed(2));
    const taxAmount = parseFloat((taxableBase * (gstRatePercent / 100)).toFixed(2));
    return { taxableBase, taxAmount };
  }

  public static calculateFeeGst(platformFee: number, deliveryFee: number): number {
    const platformGst = platformFee > 0 ? platformFee * 0.18 : 0;
    const deliveryGst = deliveryFee > 0 ? deliveryFee * 0.18 : 0;
    return parseFloat((platformGst + deliveryGst).toFixed(2));
  }

  /**
   * Inclusive Pricing Model (Document Page 1, 2 & 3)
   * Formula: Taxable Value = Price ÷ (1 + GST%)
   * GST Portion = Price − Taxable Value
   * Internal accounting back-calculation for tax-inclusive bills (Blinkit/Zepto model).
   */
  public static calculateInclusiveGst(
    totalCollected: number,
    gstRatePercent: number = 18,
  ): { taxableBase: number; taxAmount: number } {
    if (totalCollected <= 0) {
      return { taxableBase: 0, taxAmount: 0 };
    }
    const divisor = 1 + gstRatePercent / 100;
    const taxableBase = parseFloat((totalCollected / divisor).toFixed(2));
    const taxAmount = parseFloat((totalCollected - taxableBase).toFixed(2));
    return { taxableBase, taxAmount };
  }

  /**
   * Hybrid Inclusive GST Compliance Split (Document Page 4 & 5)
   * Splits internal accounting compliance between:
   * 1. Laundry Service (5% GST slab): Taxable = Laundry ÷ 1.05, GST = Laundry - Taxable
   * 2. Platform Fee + Delivery (18% GST slab): Taxable = (Platform+Delivery) ÷ 1.18, GST = (Platform+Delivery) - Taxable
   */
  public static calculateHybridInclusiveGst(
    laundryTotal: number,
    platformAndDeliveryTotal: number,
    laundryGstPercent: number = 5,
    platformGstPercent: number = 18,
  ): {
    laundryTaxable: number;
    laundryGst: number;
    platformTaxable: number;
    platformGst: number;
    totalTaxable: number;
    totalGst: number;
    grandTotal: number;
  } {
    const laundryDivisor = 1 + laundryGstPercent / 100;
    const laundryTaxable = parseFloat((laundryTotal / laundryDivisor).toFixed(2));
    const laundryGst = parseFloat((laundryTotal - laundryTaxable).toFixed(2));

    const platformDivisor = 1 + platformGstPercent / 100;
    const platformTaxable = parseFloat((platformAndDeliveryTotal / platformDivisor).toFixed(2));
    const platformGst = parseFloat((platformAndDeliveryTotal - platformTaxable).toFixed(2));

    const totalTaxable = parseFloat((laundryTaxable + platformTaxable).toFixed(2));
    const totalGst = parseFloat((laundryGst + platformGst).toFixed(2));
    const grandTotal = parseFloat((laundryTotal + platformAndDeliveryTotal).toFixed(2));

    return {
      laundryTaxable,
      laundryGst,
      platformTaxable,
      platformGst,
      totalTaxable,
      totalGst,
      grandTotal,
    };
  }

  /**
   * First Order Discount calculation:
   * - Tier 1: > 10 clothes OR order value > ₹600 -> ₹100 discount
   * - Tier 2: > 5 clothes OR order value > ₹300 OR dry cleaning -> ₹50 discount
   * - Otherwise: ₹0
   */
  public static calculateFirstOrderDiscount(
    isFirstOrder: boolean,
    totalQuantity: number,
    subtotal: number,
    hasDryCleaning: boolean = false,
  ): number {
    if (!isFirstOrder) return 0.0;
    if (totalQuantity > 10 || subtotal > 600.0) {
      return 100.0;
    } else if (totalQuantity > 5 || subtotal > 300.0 || hasDryCleaning) {
      return 50.0;
    }
    return 0.0;
  }

  /**
   * Resolves delivery charge using database pricing rules table when available,
   * with automatic fallback to static rule logic.
   */
  async getDeliveryChargeFromRules(clothesCount: number, orderValue: number): Promise<number> {
    try {
      if (this.prisma && (this.prisma as any).pricingRule) {
        const rules = await (this.prisma as any).pricingRule.findMany({
          where: { ruleType: 'DELIVERY', isActive: true },
          orderBy: { id: 'asc' },
        });

        if (rules && rules.length > 0) {
          for (const rule of rules) {
            if (OrderService.evaluateRuleCondition(clothesCount, orderValue, rule.conditionClothes, rule.conditionValue)) {
              return rule.deliveryCharge;
            }
          }
        }
      }
    } catch (e) {
      // Graceful fallback to static rule logic
    }

    return OrderService.calculateDeliveryCharge(clothesCount, orderValue);
  }

  async onModuleInit() {
    // Auto-seed default time slots if table is empty
    const count = await this.prisma.timeSlot.count();
    if (count === 0) {
      const defaultSlots = [
        "8 AM - 9 AM", "9 AM - 10 AM",
        "10 AM - 11 AM", "11 AM - 12 PM",
        "12 PM - 1 PM", "4 PM - 5 PM",
        "5 PM - 6 PM", "6 PM - 7 PM",
        "7 PM - 8 PM", "8 PM - 9 PM"
      ];
      await this.prisma.timeSlot.createMany({
        data: defaultSlots.map(name => ({
          slotName: name,
          maxCapacity: 20,
        })),
      });
      console.log('Seeded default time slots.');
    }

    // Auto-seed default pricing rules if table is empty
    try {
      if ((this.prisma as any).pricingRule) {
        const ruleCount = await (this.prisma as any).pricingRule.count();
        if (ruleCount === 0) {
          await (this.prisma as any).pricingRule.createMany({
            data: [
              {
                ruleType: 'DELIVERY',
                conditionClothes: '< 10',
                conditionValue: '<= 300',
                deliveryCharge: 30.0,
                description: 'Small order, low value',
                isActive: true,
              },
              {
                ruleType: 'DELIVERY',
                conditionClothes: '< 10',
                conditionValue: '> 300',
                deliveryCharge: 0.0,
                description: 'Small order, high value',
                isActive: true,
              },
              {
                ruleType: 'DELIVERY',
                conditionClothes: '>= 10',
                conditionValue: 'ANY',
                deliveryCharge: 0.0,
                description: 'Large order free delivery',
                isActive: true,
              },
            ],
          });
          console.log('Seeded default pricing rules.');
        }
      }
    } catch (e) {
      // Gracefully continue if unmigrated in database
    }
  }

  async syncSequences() {
    return this.prisma.syncDatabaseSequences();
  }

  async resolveServicePrice(serviceId: number, clothType: string, customerId: number, selectedPincode?: string): Promise<number> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    const pincode = selectedPincode || customer?.pincode?.trim() || 'DEFAULT';

    let product = await this.prisma.product.findFirst({
      where: {
        name: {
          equals: clothType.trim(),
          mode: 'insensitive',
        },
        isActive: true,
      },
    });

    if (!product) {
      // Fallback: search for active product where name contains clothType or vice versa
      const allActiveProducts = await this.prisma.product.findMany({
        where: { isActive: true },
      });
      product = allActiveProducts.find(p => 
        p.name.toLowerCase().includes(clothType.trim().toLowerCase()) || 
        clothType.trim().toLowerCase().includes(p.name.toLowerCase())
      ) || null;
    }

    if (!product) {
      const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
      return service?.price ?? 0.0;
    }

    let matchedPrice = await this.prisma.servicePrice.findFirst({
      where: { serviceId, productId: product.id, pincode, isActive: true },
    });

    if (!matchedPrice && pincode !== 'DEFAULT') {
      matchedPrice = await this.prisma.servicePrice.findFirst({
        where: { serviceId, productId: product.id, pincode: 'DEFAULT', isActive: true },
      });
    }

    if (matchedPrice) {
      return matchedPrice.price;
    }

    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    return service?.price ?? 0.0;
  }

  async calculateOrderBillDetails(createOrderDto: CreateOrderDto) {
    const { customerId, orderItems, couponCode, discountAmount = 0, insuranceOpted, insuranceType, addressId } = createOrderDto;

    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new NotFoundException(`Customer with ID ${customerId} not found`);

    let selectedPincode = createOrderDto.pincode;
    if (addressId) {
      const addr = await this.prisma.address.findUnique({ where: { id: addressId } });
      if (addr && addr.pincode) {
        selectedPincode = addr.pincode;
      }
    }

    let subtotal = 0;
    const resolvedItems: any[] = [];

    for (const item of orderItems) {
      const service = await this.serviceRepository.findById(item.serviceId);
      if (!service) throw new NotFoundException(`Service with ID ${item.serviceId} not found`);
      if (!service.isActive) throw new BadRequestException(`Service '${service.serviceName}' is not active`);

      const unitPrice = await this.resolveServicePrice(item.serviceId, item.clothType, customerId, selectedPincode);
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      resolvedItems.push({
        serviceId: item.serviceId,
        serviceName: service.serviceName,
        serviceType: service.serviceType,
        clothType: item.clothType,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });
    }

    const platformFee = 5.0;

    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const orderCount = await this.prisma.order.count({
      where: {
        customerId,
        orderStatus: { notIn: ['Cancelled', 'Failed'] },
      },
    });
    const isFirstOrder = orderCount === 0;

    const isPriorityOrder =
      createOrderDto.isPriority === true ||
      resolvedItems.some(item => {
        const sName = (item.serviceName || '').toLowerCase();
        const sType = (item.serviceType || '').toLowerCase();
        return sName.includes('priority') || sType.includes('priority');
      }) ||
      (createOrderDto.notes && createOrderDto.notes.toLowerCase().includes('priority'));

    // Universal Delivery Rule:
    // For Grivana Priority: Delivery charges will ALWAYS apply (₹30.00), whether 1 cloth or 20 clothes.
    // For Standard service: 
    // - 10 or more clothes: Delivery is FREE (₹0.00)
    // - Less than 10 clothes BUT Order Value (subtotal) > ₹300: Delivery is FREE (₹0.00)
    // - Less than 10 clothes AND Order Value (subtotal) <= ₹300: Delivery is charged ₹30.00
    const standardDeliveryCharge = await this.getDeliveryChargeFromRules(totalQuantity, subtotal);
    const deliveryCharge = isPriorityOrder ? 30.0 : standardDeliveryCharge;
    const freeDeliverySaving = isPriorityOrder ? 0.0 : (standardDeliveryCharge === 0.0 ? 30.0 : 0.0);

    const taxableBase = parseFloat((subtotal + platformFee + deliveryCharge).toFixed(2));
    const taxAmount = OrderService.calculateFeeGst(platformFee, deliveryCharge);

    const hasActiveInsurance = customer.insuranceExpiry && new Date(customer.insuranceExpiry) > new Date();
    let insuranceCharge = 0;
    if (insuranceOpted && !hasActiveInsurance) {
      if (insuranceType === 'MONTHLY') {
        insuranceCharge = 250.0;
      } else {
        insuranceCharge = 999.0; // YEARLY
      }
    }

    const hasDryCleaning = resolvedItems.some(item => {
      const sName = (item.serviceName || '').toLowerCase();
      const sType = (item.serviceType || '').toLowerCase();
      const cType = (item.clothType || '').toLowerCase();
      return sName.includes('dry') || sType.includes('dry') || cType.includes('dry');
    });

    const firstOrderDiscount = OrderService.calculateFirstOrderDiscount(
      isFirstOrder,
      totalQuantity,
      subtotal,
      hasDryCleaning,
    );

    const referralDiscount = 0.0;

    let couponDiscount = 0.0;
    let appliedCouponCode: string | undefined = undefined;
    if (couponCode && couponCode.trim()) {
      const codeUpper = couponCode.trim().toUpperCase();
      const coupon = await this.prisma.coupon.findUnique({ where: { code: codeUpper } });
      if (coupon && coupon.isActive) {
        couponDiscount = coupon.discount;
        appliedCouponCode = coupon.code;
      }
    } else if (discountAmount > 0) {
      // Backward compatibility fallback
      couponDiscount = discountAmount;
    }

    const grossTotal = subtotal + platformFee + taxAmount + deliveryCharge + insuranceCharge;
    let totalDiscount = firstOrderDiscount + couponDiscount;

    if (totalDiscount > grossTotal) {
      totalDiscount = grossTotal;
    }

    const netAmount = parseFloat((grossTotal - totalDiscount).toFixed(2));
    const finalPayable = netAmount;
    const roundOff = 0.0;
    const totalSavings = freeDeliverySaving + firstOrderDiscount + couponDiscount;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      platformFee,
      taxableBase,
      taxAmount,
      deliveryCharge,
      insuranceCharge,
      firstOrderDiscount,
      referralDiscount,
      couponDiscount,
      couponCode: appliedCouponCode,
      grossTotal: parseFloat(grossTotal.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      netAmount,
      roundOff,
      finalPayable,
      totalSavings: parseFloat(totalSavings.toFixed(2)),
      resolvedItems,
      isPriorityOrder,
    };
  }

  async create(createOrderDto: CreateOrderDto) {
    const { customerId, branchId, orderItems, pickupDate, deliveryDate, notes, addressId } = createOrderDto;

    // Validate Customer & Branch
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new NotFoundException(`Customer with ID ${customerId} not found`);

    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new NotFoundException(`Branch with ID ${branchId} not found`);

    if (orderItems.length === 0) {
      throw new BadRequestException('Order must contain at least one service item');
    }

    // Call unified calculation
    const bill = await this.calculateOrderBillDetails(createOrderDto);

    // Grivana Priority Business Logic Checks
    if (bill.isPriorityOrder) {
      // 1. Validate Time Slot - Must be Before 11 AM
      let slotString = '';
      if (notes && notes.includes('Slot:')) {
        const slotPart = notes.split('|').find(p => p.includes('Slot:'));
        if (slotPart) {
          slotString = slotPart.replace('Slot:', '').trim();
        }
      }

      if (slotString) {
        const slotLower = slotString.toLowerCase();
        const isAfter11 =
          slotLower.includes('11 am - 12 pm') ||
          slotLower.includes('12 pm') ||
          slotLower.includes('1 pm') ||
          slotLower.includes('2 pm') ||
          slotLower.includes('3 pm') ||
          slotLower.includes('4 pm') ||
          slotLower.includes('5 pm') ||
          slotLower.includes('6 pm') ||
          slotLower.includes('7 pm') ||
          slotLower.includes('8 pm') ||
          slotLower.includes('9 pm');

        if (isAfter11) {
          throw new BadRequestException(
            'Grivana Priority pickups are only available for morning slots before 11:00 AM (e.g. 8 AM - 9 AM, 9 AM - 10 AM, 10 AM - 11 AM). Please select a morning slot before 11 AM.'
          );
        }
      }

      // 2. Validate Daily Capping of 25 Orders
      const targetPickup = pickupDate ? new Date(pickupDate) : new Date();
      const startOfDay = new Date(targetPickup);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetPickup);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const existingPriorityCount = await this.prisma.order.count({
        where: {
          pickupDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          orderItems: {
            some: {
              service: {
                OR: [
                  { serviceName: { contains: 'Priority', mode: 'insensitive' } },
                  { serviceType: { contains: 'Priority', mode: 'insensitive' } },
                ],
              },
            },
          },
          orderStatus: { notIn: ['Cancelled'] },
        },
      });

      if (existingPriorityCount >= 25) {
        throw new BadRequestException(
          'Daily limit of 25 Grivana Priority orders has been reached for this date. Please choose another date or standard service.'
        );
      }
    }

    // Resolve address fields for order snapshot
    let addressTitle = createOrderDto.addressTitle ?? null;
    let address = createOrderDto.address ?? null;
    let city = createOrderDto.city ?? null;
    let state = createOrderDto.state ?? null;
    let pincode = createOrderDto.pincode ?? null;
    let landmark = createOrderDto.landmark ?? null;
    let houseDetails = createOrderDto.houseDetails ?? null;

    if (addressId) {
      const addr = await this.prisma.address.findUnique({
        where: { id: addressId },
      });
      if (addr) {
        addressTitle = addr.title ?? null;
        address = addr.address ?? null;
        city = addr.city ?? null;
        state = addr.state ?? null;
        pincode = addr.pincode ?? null;
        landmark = addr.landmark ?? null;
        houseDetails = addr.houseDetails ?? null;
      }
    } else if (!address) {
      const defaultAddr = await this.prisma.address.findFirst({
        where: { customerId, isDefault: true },
      });
      if (defaultAddr) {
        addressTitle = defaultAddr.title ?? null;
        address = defaultAddr.address ?? null;
        city = defaultAddr.city ?? null;
        state = defaultAddr.state ?? null;
        pincode = defaultAddr.pincode ?? null;
        landmark = defaultAddr.landmark ?? null;
        houseDetails = defaultAddr.houseDetails ?? null;
      } else {
        addressTitle = 'Default';
        address = customer.address ?? null;
        city = customer.city ?? null;
        state = customer.state ?? null;
        pincode = customer.pincode ?? null;
        landmark = customer.landmark ?? null;
        houseDetails = customer.houseDetails ?? null;
      }
    }

    // Build items to create
    const itemsToCreate = bill.resolvedItems.map(item => ({
      serviceId: item.serviceId,
      clothType: item.clothType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    // Generate OrderNumber safely
    const maxOrder = await this.prisma.order.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    let seq = (maxOrder?.id || 0) + 1;
    let orderNumber = `ORD-${String(seq).padStart(5, '0')}`;
    while (await this.prisma.order.findUnique({ where: { orderNumber } })) {
      seq++;
      orderNumber = `ORD-${String(seq).padStart(5, '0')}`;
    }

    // Create Order + OrderItems in a transaction
    const resultOrder = await this.prisma.$transaction(async (tx) => {
      // If insurance is opted and customer does not have active insurance, extend subscription
      const hasActiveInsurance = customer.insuranceExpiry && new Date(customer.insuranceExpiry) > new Date();
      if (createOrderDto.insuranceOpted && !hasActiveInsurance) {
        const expiryDate = new Date();
        if (createOrderDto.insuranceType === 'MONTHLY') {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }
        await tx.customer.update({
          where: { id: customerId },
          data: { insuranceExpiry: expiryDate },
        });
      }

      const deliveryNote = bill.isPriorityOrder
        ? 'Delivery: Paid (Priority Express ₹30)'
        : (bill.deliveryCharge === 0.0 ? 'Delivery: Free' : 'Delivery: Paid');
      let orderNotes = notes ? `${notes} | ${deliveryNote}` : deliveryNote;
      if (bill.couponCode) {
        orderNotes += ` | Coupon Code Applied: ${bill.couponCode}`;
      }

      // Determine initial payment status and payment details
      let initialPaymentStatus = 'Pending';
      let resolvedPaymentMode = createOrderDto.paymentMode;
      let resolvedPaidAmount = createOrderDto.paidAmount;
      let resolvedTxnRef = createOrderDto.transactionReference;

      if (resolvedPaymentMode === 'Razorpay') {
        resolvedPaymentMode = 'UPI (Razorpay)';
      }

      // Also inspect orderNotes for credit deduction or instant payment
      if (!resolvedPaymentMode && orderNotes) {
        if (orderNotes.includes('Grivana Credits (100% Covered)') || orderNotes.includes('Payment Mode: Grivana Credits')) {
          resolvedPaymentMode = 'Grivana Credits';
          resolvedPaidAmount = bill.finalPayable;
        } else if (orderNotes.includes('Payment Mode: GPay') || orderNotes.includes('Payment Mode: Google Pay')) {
          resolvedPaymentMode = 'Google Pay / UPI';
          resolvedPaidAmount = bill.finalPayable;
        } else if (orderNotes.includes('Payment Mode: Razorpay') || orderNotes.includes('Payment Mode: UPI (Razorpay)')) {
          resolvedPaymentMode = 'UPI (Razorpay)';
          resolvedPaidAmount = bill.finalPayable;
        } else if (orderNotes.includes('Payment Mode: UPI')) {
          resolvedPaymentMode = 'UPI';
          resolvedPaidAmount = bill.finalPayable;
        }
      }

      if (resolvedPaidAmount === undefined || resolvedPaidAmount === null) {
        if (orderNotes) {
          const creditMatch = orderNotes.match(/Grivana Credits Applied:\s*Rs\.\s*([\d.]+)/i);
          if (creditMatch) {
            const parsedCredits = parseFloat(creditMatch[1]);
            if (!isNaN(parsedCredits) && parsedCredits > 0) {
              resolvedPaidAmount = parsedCredits;
              if (!resolvedPaymentMode) resolvedPaymentMode = 'Grivana Credits';
            }
          }
        }
      }

      if (!resolvedTxnRef && orderNotes) {
        const txnMatch = orderNotes.match(/Txn Ref:\s*([^\s|]+)/i);
        if (txnMatch) {
          resolvedTxnRef = txnMatch[1].trim();
        }
      }

      let paymentToCreate: any = null;
      if (resolvedPaidAmount !== undefined && resolvedPaidAmount !== null && resolvedPaidAmount > 0) {
        if (resolvedPaidAmount >= bill.finalPayable) {
          initialPaymentStatus = 'Paid';
        } else {
          initialPaymentStatus = 'Partially Paid';
        }

        paymentToCreate = {
          amount: resolvedPaidAmount,
          paymentMode: resolvedPaymentMode || 'Grivana Credits',
          transactionReference: resolvedTxnRef || `AUTO-${Date.now()}`,
          paymentStatus: 'Completed',
        };
      }

      // Synchronize First Order Discount note with true calculated bill.firstOrderDiscount
      if (bill.firstOrderDiscount > 0) {
        if (/First Order Discount:\s*Rs\.\s*[\d.]+\s*Applied/i.test(orderNotes)) {
          orderNotes = orderNotes.replace(/First Order Discount:\s*Rs\.\s*[\d.]+\s*Applied/i, `First Order Discount: Rs. ${bill.firstOrderDiscount.toFixed(0)} Applied`);
        } else {
          orderNotes = orderNotes ? `${orderNotes} | First Order Discount: Rs. ${bill.firstOrderDiscount.toFixed(0)} Applied` : `First Order Discount: Rs. ${bill.firstOrderDiscount.toFixed(0)} Applied`;
        }
      } else if (/First Order Discount:\s*Rs\.\s*[\d.]+\s*Applied/i.test(orderNotes)) {
        orderNotes = orderNotes.replace(/\|\s*First Order Discount:\s*Rs\.\s*[\d.]+\s*Applied/i, '')
                               .replace(/First Order Discount:\s*Rs\.\s*[\d.]+\s*Applied\s*\|?/i, '')
                               .trim();
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          branchId,
          pickupDate: pickupDate && !isNaN(Date.parse(pickupDate)) ? new Date(pickupDate) : null,
          deliveryDate: deliveryDate && !isNaN(Date.parse(deliveryDate)) ? new Date(deliveryDate) : null,
          orderStatus: 'New Order',
          paymentStatus: initialPaymentStatus,
          totalAmount: bill.subtotal,
          discountAmount: bill.totalDiscount,
          taxAmount: bill.taxAmount,
          netAmount: bill.finalPayable,
          notes: orderNotes,
          addressTitle: addressTitle ?? null,
          address: address ?? null,
          city: city ?? null,
          state: state ?? null,
          pincode: pincode ?? null,
          landmark: landmark ?? null,
          houseDetails: houseDetails ?? null,
          orderItems: {
            create: itemsToCreate,
          },
          statusHistory: {
            create: { status: 'New Order' }
          }
        },
        include: {
          orderItems: {
            include: { service: true },
          },
          customer: true,
          branch: true,
          statusHistory: true,
        },
      });

      if (paymentToCreate) {
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: paymentToCreate.amount,
            paymentMode: paymentToCreate.paymentMode,
            transactionReference: paymentToCreate.transactionReference,
            paymentStatus: 'Completed',
          },
        });
      }

      // Create a default notification log for customer
      await tx.notification.create({
        data: {
          customerId: customer.id,
          message: `Your laundry order ${order.orderNumber} has been successfully created.`,
          notificationType: 'Push',
          isSent: true,
          sentDate: new Date(),
        },
      });

      return this.enrichOrderWithBillingDetails(order);
    });

    // Send order confirmation email — outside of transaction so DB commit is
    // completed first and not held open waiting for a network call to the email provider.
    const targetEmail = (resultOrder.customer?.email || customer?.email || '').trim();
    const customerName = (resultOrder.customer?.firstName || customer?.firstName || 'Customer').trim();

    if (targetEmail && targetEmail.includes('@')) {
      this.notificationSender.sendOrderCreatedEmail(
        targetEmail,
        customerName,
        resultOrder.orderNumber,
        resultOrder.netAmount,
        resultOrder.orderItems
      ).catch(err => {
        console.error(`[ORDER EMAIL FAILED] Order ${resultOrder.orderNumber} to ${targetEmail}:`, err?.message || err);
      });
    } else {
      console.warn(`[ORDER EMAIL SKIPPED] Customer has no valid email. Order: ${resultOrder.orderNumber} | customerId: ${resultOrder.customerId}`);
    }

    return resultOrder;
  }

  enrichOrderWithBillingDetails(order: any) {
    if (!order) return order;

    const subtotal = order.totalAmount;
    const taxAmount = order.taxAmount;
    const discountAmount = order.discountAmount;
    const netAmount = order.netAmount;

    const platformFee = 5.0;

    // Count total clothes quantity
    const totalQuantity = order.orderItems 
      ? order.orderItems.reduce((sum: number, item: any) => sum + item.quantity, 0)
      : 0;
    
    const isPriorityOrder =
      (order.orderItems &&
        order.orderItems.some((item: any) => {
          const sName = (item.service?.serviceName || item.serviceName || '').toLowerCase();
          const sType = (item.service?.serviceType || item.serviceType || '').toLowerCase();
          return sName.includes('priority') || sType.includes('priority');
        })) ||
      (order.notes && order.notes.toLowerCase().includes('priority'));

    const standardDeliveryCharge = OrderService.calculateDeliveryCharge(totalQuantity, subtotal);
    const deliveryCharge = isPriorityOrder ? 30.0 : standardDeliveryCharge;
    const freeDeliverySaving = isPriorityOrder ? 0.0 : (standardDeliveryCharge === 0.0 ? 30.0 : 0.0);

    // Reconstruct insurance charge
    const reconstructedInsurance = netAmount - subtotal - taxAmount - platformFee - deliveryCharge + discountAmount;
    const insuranceCharge = reconstructedInsurance > 0 ? parseFloat(reconstructedInsurance.toFixed(2)) : 0.0;

    // Check notes for Coupon Code
    let couponCode: string | undefined = undefined;
    if (order.notes && order.notes.includes('Coupon Code Applied:')) {
      const match = order.notes.match(/Coupon Code Applied:\s*([A-Z0-9_-]+)/i);
      if (match && match[1]) {
        couponCode = match[1];
      }
    }

    const grossTotal = subtotal + platformFee + taxAmount + deliveryCharge + insuranceCharge;
    const totalSavings = freeDeliverySaving + discountAmount;

    // Reconstruct roundOff
    const exactNet = grossTotal - discountAmount;
    const roundOff = parseFloat((netAmount - exactNet).toFixed(2));

    // Extract active delivery OTP if generated
    let deliveryOtp: string | undefined = undefined;
    if (order.deliveries && Array.isArray(order.deliveries)) {
      const activeDelivery = order.deliveries.find((d: any) => d.deliveryOtp);
      if (activeDelivery) {
        deliveryOtp = activeDelivery.deliveryOtp;
      }
    }

    // Sanitize any legacy "First Order Discount: Rs. 20 Applied" notes if actual discount was >= Rs. 50
    let sanitizedNotes = order.notes;
    if (sanitizedNotes && /First Order Discount:\s*Rs\.\s*20\s*Applied/i.test(sanitizedNotes) && discountAmount >= 50) {
      sanitizedNotes = sanitizedNotes.replace(/First Order Discount:\s*Rs\.\s*20\s*Applied/i, `First Order Discount: Rs. ${discountAmount.toFixed(0)} Applied`);
    }

    return {
      ...order,
      notes: sanitizedNotes,
      platformFee,
      taxableBase: parseFloat((subtotal + platformFee + deliveryCharge).toFixed(2)),
      deliveryCharge,
      insuranceCharge,
      couponCode,
      grossTotal: parseFloat(grossTotal.toFixed(2)),
      roundOff,
      finalPayable: netAmount,
      totalSavings: parseFloat(totalSavings.toFixed(2)),
      deliveryOtp,
      latestDeliveryOtp: deliveryOtp,
    };
  }

  async findAll() {
    const orders = await this.orderRepository.findAll({
      include: {
        customer: true,
        branch: true,
        laundryShop: true,
        orderItems: { include: { service: true } },
        payments: true,
        deliveries: true,
        statusHistory: { orderBy: { createdDate: 'asc' } },
      },
      orderBy: { createdDate: 'desc' },
    });
    return orders.map(o => this.enrichOrderWithBillingDetails(o));
  }

  async findOne(id: number) {
    const order = await this.orderRepository.findDetailed(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return this.enrichOrderWithBillingDetails(order);
  }

  async updateStatus(id: number, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);
    const updated = await this.orderRepository.update(id, { orderStatus: dto.orderStatus });

    // Create status history entry
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: dto.orderStatus,
      },
    });

    // Try to record notification
    await this.prisma.notification.create({
      data: {
        customerId: order.customerId,
        message: `Your order ${order.orderNumber} status has changed to: ${dto.orderStatus}`,
        notificationType: 'Push',
        isSent: true,
        sentDate: new Date(),
      },
    });

    // Send order status update email (only if customer has a valid email)
    if (order.customer?.email && order.customer.email.trim().includes('@')) {
      this.notificationSender.sendOrderStatusUpdateEmail(
        order.customer.email.trim(),
        order.customer.firstName || 'Customer',
        order.orderNumber,
        dto.orderStatus
      ).catch(err => {
        console.error(`[STATUS EMAIL FAILED] Order ${order.orderNumber} status=${dto.orderStatus}:`, err?.message || err);
      });
    } else {
      console.warn(`[STATUS EMAIL SKIPPED] No valid email for order ${order.orderNumber} | customerId: ${order.customerId}`);
    }

    return this.enrichOrderWithBillingDetails(updated);
  }

  async updatePaymentStatus(id: number, dto: UpdatePaymentStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    const updated = await this.orderRepository.update(id, { paymentStatus: dto.paymentStatus });

    let mode = dto.paymentMode;
    if (mode === 'Razorpay') {
      mode = 'UPI (Razorpay)';
    }

    if (dto.paymentStatus === 'Paid' || dto.paymentStatus === 'PAID') {
      const existingPayment = await this.prisma.payment.findFirst({ where: { orderId: id } });
      if (!mode) {
        if (existingPayment?.paymentMode && existingPayment.paymentMode !== 'Cash') {
          mode = existingPayment.paymentMode === 'Razorpay' ? 'UPI (Razorpay)' : existingPayment.paymentMode;
        } else if (order.notes) {
          const notesLower = order.notes.toLowerCase();
          if (notesLower.includes('razorpay')) mode = 'UPI (Razorpay)';
          else if (notesLower.includes('gpay')) mode = 'GPay';
          else if (notesLower.includes('upi')) mode = 'UPI';
          else mode = 'Cash';
        } else {
          mode = 'Cash';
        }
      }

      if (existingPayment) {
        await this.prisma.payment.update({
          where: { id: existingPayment.id },
          data: { paymentMode: mode, paymentStatus: 'Paid', paidDate: new Date() }
        });
      } else {
        await this.prisma.payment.create({
          data: {
            orderId: id,
            amount: order.netAmount,
            paymentMode: mode,
            paymentStatus: 'Paid',
            paidDate: new Date()
          }
        });
      }

      if (order.customer?.email) {
        this.notificationSender.sendPaymentReceivedEmail(
          order.customer.email,
          order.customer.firstName,
          order.orderNumber,
          order.netAmount,
          mode
        ).catch(err => {
          console.error('Payment confirmation email failed:', err);
        });
      }
    }

    return this.enrichOrderWithBillingDetails(updated);
  }

  async findByCustomer(customerId: number) {
    const orders = await this.orderRepository.findAll({
      where: { customerId },
      include: {
        customer: true,
        branch: true,
        laundryShop: true,
        orderItems: { include: { service: true } },
        payments: true,
        deliveries: true,
        statusHistory: { orderBy: { createdDate: 'asc' } },
      },
      orderBy: { createdDate: 'desc' },
    });
    return orders.map(o => this.enrichOrderWithBillingDetails(o));
  }

  async assignToShop(orderId: number, dto: AssignShopDto) {
    const order = await this.findOne(orderId);

    // Validate the laundry shop exists
    const shop = await this.prisma.laundryShop.findUnique({
      where: { id: dto.laundryShopId },
    });
    if (!shop) {
      throw new NotFoundException(`Laundry shop with ID ${dto.laundryShopId} not found`);
    }
    if (!shop.isActive) {
      throw new BadRequestException(`Laundry shop "${shop.shopName}" is not active`);
    }

    // Advance orderStatus to Laundry if still in earlier stages
    const newStatus = ['New Order', 'Pickup Scheduled', 'Picked Up'].includes(order.orderStatus)
      ? 'Laundry'
      : order.orderStatus;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        laundryShopId: dto.laundryShopId,
        orderStatus: newStatus,
      },
      include: { laundryShop: true, customer: true },
    });

    // Create a status history entry
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: `Assigned to Laundry`,
      },
    });

    // Notification
    await this.prisma.notification.create({
      data: {
        customerId: order.customerId,
        message: `Your order ${order.orderNumber} has been assigned to laundry for processing.`,
        notificationType: 'Push',
        isSent: true,
        sentDate: new Date(),
      },
    });

    return updated;
  }

  async bulkAssignToShop(dto: BulkAssignShopDto) {
    // Validate the laundry shop exists
    const shop = await this.prisma.laundryShop.findUnique({
      where: { id: dto.laundryShopId },
    });
    if (!shop) {
      throw new NotFoundException(`Laundry shop with ID ${dto.laundryShopId} not found`);
    }
    if (!shop.isActive) {
      throw new BadRequestException(`Laundry shop "${shop.shopName}" is not active`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Update all orders
      await tx.order.updateMany({
        where: { id: { in: dto.orderIds } },
        data: { laundryShopId: dto.laundryShopId },
      });

      // Fetch orders for notifications
      const orders = await tx.order.findMany({
        where: { id: { in: dto.orderIds } },
        select: { id: true, orderNumber: true, customerId: true },
      });

      // Create status history for each order
      await tx.orderStatusHistory.createMany({
        data: orders.map((o) => ({
          orderId: o.id,
          status: `Assigned to Laundry`,
        })),
      });

      // Create notifications for each customer
      await tx.notification.createMany({
        data: orders.map((o) => ({
          customerId: o.customerId,
          message: `Your order ${o.orderNumber} has been assigned to laundry for processing.`,
          notificationType: 'Push',
          isSent: true,
          sentDate: new Date(),
        })),
      });

      return {
        assigned: orders.length,
        laundryShop: shop,
        orderIds: dto.orderIds,
      };
    });
  }

  // ── TIME SLOT MANAGEMENT METHODS ──

  async getAvailableSlots(date?: string, pincode?: string, isPriority?: boolean | string) {
    const targetDate = date ? new Date(date) : new Date();
    const priorityMode = isPriority === true || isPriority === 'true';

    // Set start of day and end of day in UTC
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    let slots = await this.prisma.timeSlot.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    if (priorityMode) {
      // For Grivana Priority, only slots BEFORE 11 AM are valid
      slots = slots.filter(s => {
        const name = s.slotName.toLowerCase();
        return (
          name.includes('8 am - 9 am') ||
          name.includes('9 am - 10 am') ||
          name.includes('10 am - 11 am') ||
          name.includes('before 11 am') ||
          name.includes('6 am - 8 am') ||
          name.includes('7 am - 9 am') ||
          name.includes('8 am - 10 am') ||
          name.includes('9 am - 11 am')
        );
      });

      // Check 25 Orders Daily Capping for Grivana Priority
      const priorityOrdersCount = await this.prisma.order.count({
        where: {
          pickupDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          orderItems: {
            some: {
              service: {
                OR: [
                  { serviceName: { contains: 'Priority', mode: 'insensitive' } },
                  { serviceType: { contains: 'Priority', mode: 'insensitive' } },
                ],
              },
            },
          },
          orderStatus: { notIn: ['Cancelled'] },
        },
      });

      const isDailyCapReached = priorityOrdersCount >= 25;

      return slots.map(slot => ({
        id: slot.id,
        slotName: slot.slotName,
        maxCapacity: 25,
        bookedCount: priorityOrdersCount,
        isFull: isDailyCapReached,
        isPriority: true,
      }));
    }

    const result: any[] = [];
    for (const slot of slots) {
      // Count orders booked in this slot on this date
      // Optionally filter by pincode if provided
      const count = await this.prisma.order.count({
        where: {
          pickupDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          notes: {
            contains: `Slot: ${slot.slotName}`,
          },
          customer: pincode && pincode.trim().length > 0 ? {
            pincode: pincode.trim(),
          } : undefined,
        },
      });

      result.push({
        id: slot.id,
        slotName: slot.slotName,
        maxCapacity: slot.maxCapacity,
        bookedCount: count,
        isFull: count >= slot.maxCapacity,
      });
    }

    return result;
  }

  async getTimeSlotsAdmin() {
    return this.prisma.timeSlot.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async createTimeSlot(dto: CreateTimeSlotDto) {
    return this.prisma.timeSlot.create({
      data: {
        slotName: dto.slotName,
        maxCapacity: dto.maxCapacity ?? 20,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateTimeSlot(id: number, dto: UpdateTimeSlotDto) {
    return this.prisma.timeSlot.update({
      where: { id },
      data: dto,
    });
  }

  async deleteTimeSlot(id: number) {
    return this.prisma.timeSlot.delete({
      where: { id },
    });
  }
}
