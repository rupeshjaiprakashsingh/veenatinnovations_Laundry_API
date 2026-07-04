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

  async create(createOrderDto: CreateOrderDto) {
    const { customerId, branchId, orderItems, discountAmount = 0, pickupDate, deliveryDate, notes } = createOrderDto;

    // Validate Customer & Branch
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new NotFoundException(`Customer with ID ${customerId} not found`);

    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new NotFoundException(`Branch with ID ${branchId} not found`);

    if (orderItems.length === 0) {
      throw new BadRequestException('Order must contain at least one service item');
    }

    // 1. Calculate price and build item list
    let totalAmount = 0;
    const itemsToCreate: any[] = [];

    for (const item of orderItems) {
      const service = await this.serviceRepository.findById(item.serviceId);
      if (!service) throw new NotFoundException(`Service with ID ${item.serviceId} not found`);
      if (!service.isActive) throw new BadRequestException(`Service '${service.serviceName}' is not active`);

      const unitPrice = service.price;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      itemsToCreate.push({
        serviceId: item.serviceId,
        clothType: item.clothType,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });
    }

    // 2. Tax details (e.g. 5% GST/tax) and fees
    const taxAmount = parseFloat((totalAmount * 0.05).toFixed(2));
    const platformFee = 5.0;
    
    // Count total clothes quantity in this order
    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const deliveryCharge = totalQuantity >= 10 ? 0.0 : 20.0;

    // Check if customer already has active insurance (valid for 1 year or 1 month)
    const hasActiveInsurance = customer.insuranceExpiry && new Date(customer.insuranceExpiry) > new Date();
    let insuranceCharge = 0;
    
    if (createOrderDto.insuranceOpted && !hasActiveInsurance) {
      if (createOrderDto.insuranceType === 'MONTHLY') {
        insuranceCharge = 50.0;
      } else {
        insuranceCharge = 500.0; // default / yearly
      }
    }

    // Check if this is the customer's first order
    const orderCount = await this.prisma.order.count({ where: { customerId } });
    let firstOrderDiscount = 0.0;
    if (orderCount === 0) {
      firstOrderDiscount = 20.0; // Apply Rs 20 first order discount
    }

    // ── REFERRAL SYSTEM DISCOUNT (Rs 50) ──
    let referralDiscount = 0.0;
    let referralToUpdateReferredId: number | null = null;
    let referralToUpdateReferrerId: number | null = null;

    // A. Referee Discount: New user gets Rs 50 off on their first order
    const pendingRefereeReferral = await this.prisma.referral.findUnique({
      where: { referredId: customerId },
    });
    
    if (pendingRefereeReferral && !pendingRefereeReferral.referredUsed) {
      referralDiscount += 50.0;
      referralToUpdateReferredId = pendingRefereeReferral.id;
    }

    // B. Referrer Discount: Referrer gets Rs 50 off for referring someone who signed up
    if (referralDiscount === 0.0) { // Apply referrer bonus if referee bonus is not already being used on this order
      const pendingReferrerReferral = await this.prisma.referral.findFirst({
        where: {
          referrerId: customerId,
          referrerUsed: false,
        },
      });

      if (pendingReferrerReferral) {
        referralDiscount += 50.0;
        referralToUpdateReferrerId = pendingReferrerReferral.id;
      }
    }

    let finalDiscount = discountAmount + firstOrderDiscount + referralDiscount;
    const baseTotal = totalAmount + taxAmount + platformFee + deliveryCharge + insuranceCharge;
    if (finalDiscount > baseTotal) {
      finalDiscount = baseTotal; // Capped at base total
    }
    const netAmount = parseFloat((baseTotal - finalDiscount).toFixed(2));

    if (netAmount < 0) {
      throw new BadRequestException('Net amount cannot be negative');
    }

    // 3. Generate OrderNumber
    const count = await this.prisma.order.count();
    const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;

    // 4. Create Order + OrderItems in a transaction
    return this.prisma.$transaction(async (tx) => {
      // If insurance is opted and customer does not have active insurance, extend subscription based on type
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

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          branchId,
          pickupDate: pickupDate ? new Date(pickupDate) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          orderStatus: 'New Order',
          paymentStatus: 'Pending',
          totalAmount,
          discountAmount: finalDiscount,
          taxAmount,
          netAmount,
          notes: referralDiscount > 0
            ? (notes ? `${notes} | Referral Discount Applied: Rs 50` : 'Referral Discount Applied: Rs 50')
            : notes,
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

  async findAll() {
    return this.orderRepository.findAll({
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
  }

  async findOne(id: number) {
    const order = await this.orderRepository.findDetailed(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
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

    return updated;
  }

  async updatePaymentStatus(id: number, dto: UpdatePaymentStatusDto) {
    await this.findOne(id);
    return this.orderRepository.update(id, { paymentStatus: dto.paymentStatus });
  }

  async findByCustomer(customerId: number) {
    return this.orderRepository.findAll({
      where: { customerId },
      include: {
        orderItems: { include: { service: true } },
        payments: true,
        deliveries: true,
        statusHistory: { orderBy: { createdDate: 'asc' } },
      },
      orderBy: { createdDate: 'desc' },
    });
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
