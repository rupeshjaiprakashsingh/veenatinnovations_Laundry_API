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
        clothType: item.clothType,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });
    }

    const platformFee = 5.0;

    // Configurable GST/Tax Rate (default 5%)
    const gstRatePercent = parseFloat(process.env.GST_RATE || '5');
    const gstRate = gstRatePercent / 100;
    const taxAmount = parseFloat((subtotal * gstRate).toFixed(2));

    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const orderCount = await this.prisma.order.count({ where: { customerId } });
    const isFirstOrder = orderCount === 0;

    const deliveryCharge = isFirstOrder ? 0.0 : 20.0;
    const freeDeliverySaving = isFirstOrder ? 20.0 : 0.0;

    const hasActiveInsurance = customer.insuranceExpiry && new Date(customer.insuranceExpiry) > new Date();
    let insuranceCharge = 0;
    if (insuranceOpted && !hasActiveInsurance) {
      if (insuranceType === 'MONTHLY') {
        insuranceCharge = 50.0;
      } else {
        insuranceCharge = 500.0; // YEARLY
      }
    }

    const firstOrderDiscount = (isFirstOrder && totalQuantity > 5) ? 50.0 : 0.0;

    let referralDiscount = 0.0;
    const pendingRefereeReferral = await this.prisma.referral.findUnique({
      where: { referredId: customerId },
    });
    if (pendingRefereeReferral && !pendingRefereeReferral.referredUsed) {
      referralDiscount = 50.0;
    } else {
      const pendingReferrerReferral = await this.prisma.referral.findFirst({
        where: { referrerId: customerId, referrerUsed: false },
      });
      if (pendingReferrerReferral) {
        referralDiscount = 50.0;
      }
    }

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
    let totalDiscount = firstOrderDiscount + referralDiscount + couponDiscount;

    if (totalDiscount > grossTotal) {
      totalDiscount = grossTotal;
    }

    const netAmount = parseFloat((grossTotal - totalDiscount).toFixed(2));
    const finalPayable = netAmount;
    const roundOff = 0.0;
    const totalSavings = freeDeliverySaving + firstOrderDiscount + referralDiscount + couponDiscount;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      platformFee,
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

    // Resolve address fields for order snapshot
    let addressTitle = createOrderDto.addressTitle;
    let address = createOrderDto.address;
    let city = createOrderDto.city;
    let state = createOrderDto.state;
    let pincode = createOrderDto.pincode;
    let landmark = createOrderDto.landmark;
    let houseDetails = createOrderDto.houseDetails;

    if (addressId) {
      const addr = await this.prisma.address.findUnique({
        where: { id: addressId },
      });
      if (addr) {
        addressTitle = addr.title;
        address = addr.address;
        city = addr.city ?? undefined;
        state = addr.state ?? undefined;
        pincode = addr.pincode ?? undefined;
        landmark = addr.landmark ?? undefined;
        houseDetails = addr.houseDetails ?? undefined;
      }
    } else if (!address) {
      const defaultAddr = await this.prisma.address.findFirst({
        where: { customerId, isDefault: true },
      });
      if (defaultAddr) {
        addressTitle = defaultAddr.title;
        address = defaultAddr.address;
        city = defaultAddr.city ?? undefined;
        state = defaultAddr.state ?? undefined;
        pincode = defaultAddr.pincode ?? undefined;
        landmark = defaultAddr.landmark ?? undefined;
        houseDetails = defaultAddr.houseDetails ?? undefined;
      } else {
        addressTitle = 'Default';
        address = customer.address ?? undefined;
        city = customer.city ?? undefined;
        state = customer.state ?? undefined;
        pincode = customer.pincode ?? undefined;
        landmark = customer.landmark ?? undefined;
        houseDetails = customer.houseDetails ?? undefined;
      }
    }

    // Call unified calculation
    const bill = await this.calculateOrderBillDetails(createOrderDto);

    // Build items to create
    const itemsToCreate = bill.resolvedItems.map(item => ({
      serviceId: item.serviceId,
      clothType: item.clothType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    // Find pending referrals to mark as used
    let referralToUpdateReferredId: number | null = null;
    let referralToUpdateReferrerId: number | null = null;

    if (bill.referralDiscount > 0) {
      const pendingRefereeReferral = await this.prisma.referral.findUnique({
        where: { referredId: customerId },
      });
      if (pendingRefereeReferral && !pendingRefereeReferral.referredUsed) {
        referralToUpdateReferredId = pendingRefereeReferral.id;
      } else {
        const pendingReferrerReferral = await this.prisma.referral.findFirst({
          where: { referrerId: customerId, referrerUsed: false },
        });
        if (pendingReferrerReferral) {
          referralToUpdateReferrerId = pendingReferrerReferral.id;
        }
      }
    }

    // Generate OrderNumber
    const count = await this.prisma.order.count();
    const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;

    // Create Order + OrderItems in a transaction
    return this.prisma.$transaction(async (tx) => {
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

      if (referralToUpdateReferredId) {
        await tx.referral.update({
          where: { id: referralToUpdateReferredId },
          data: { referredUsed: true },
        });
      }

      if (referralToUpdateReferrerId) {
        await tx.referral.update({
          where: { id: referralToUpdateReferrerId },
          data: { referrerUsed: true },
        });
      }

      const deliveryNote = bill.deliveryCharge === 0.0 ? 'Delivery: Free (First Order)' : 'Delivery: Paid';
      let orderNotes = notes ? `${notes} | ${deliveryNote}` : deliveryNote;
      if (bill.couponCode) {
        orderNotes += ` | Coupon Code Applied: ${bill.couponCode}`;
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          branchId,
          pickupDate: pickupDate ? new Date(pickupDate) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          orderStatus: 'New Order',
          paymentStatus: 'Pending',
          totalAmount: bill.subtotal,
          discountAmount: bill.totalDiscount,
          taxAmount: bill.taxAmount,
          netAmount: bill.finalPayable,
          notes: orderNotes,
          addressTitle,
          address,
          city,
          state,
          pincode,
          landmark,
          houseDetails,
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

      // Send order confirmation email
      this.notificationSender.sendOrderCreatedEmail(
        order.customer.email,
        order.customer.firstName,
        order.orderNumber,
        order.netAmount,
        order.orderItems
      ).catch(err => {
        console.error('Order created confirmation email failed:', err);
      });

      return order;
    });
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
    
    let deliveryCharge = 20.0;
    if (order.notes) {
      if (order.notes.includes('Delivery: Free (First Order)')) {
        deliveryCharge = 0.0;
      } else if (order.notes.includes('Delivery: Paid')) {
        deliveryCharge = 20.0;
      } else {
        // Fallback for legacy orders
        deliveryCharge = totalQuantity >= 10 ? 0.0 : 20.0;
      }
    } else {
      deliveryCharge = totalQuantity >= 10 ? 0.0 : 20.0;
    }
    const freeDeliverySaving = deliveryCharge === 0.0 ? 20.0 : 0.0;

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

    return {
      ...order,
      platformFee,
      deliveryCharge,
      insuranceCharge,
      couponCode,
      grossTotal: parseFloat(grossTotal.toFixed(2)),
      roundOff,
      finalPayable: netAmount,
      totalSavings: parseFloat(totalSavings.toFixed(2)),
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

    return this.enrichOrderWithBillingDetails(updated);
  }

  async updatePaymentStatus(id: number, dto: UpdatePaymentStatusDto) {
    await this.findOne(id);
    const updated = await this.orderRepository.update(id, { paymentStatus: dto.paymentStatus });
    return this.enrichOrderWithBillingDetails(updated);
  }

  async findByCustomer(customerId: number) {
    const orders = await this.orderRepository.findAll({
      where: { customerId },
      include: {
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

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { laundryShopId: dto.laundryShopId },
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

  async getAvailableSlots(date?: string, pincode?: string) {
    const targetDate = date ? new Date(date) : new Date();
    
    // Set start of day and end of day in UTC
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const slots = await this.prisma.timeSlot.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

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
        isActive: true,
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
