import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderRepository, ServiceRepository, CustomerRepository, BranchRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto, UpdatePaymentStatusDto } from './dto/order.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly branchRepository: BranchRepository,
    private readonly prisma: PrismaService,
  ) {}

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

    // 2. Tax details (e.g. 5% GST/tax)
    const taxAmount = parseFloat((totalAmount * 0.05).toFixed(2));

    // Check if customer already has active insurance (valid for 1 year)
    const hasActiveInsurance = customer.insuranceExpiry && new Date(customer.insuranceExpiry) > new Date();
    let insuranceCharge = 0;
    
    if (createOrderDto.insuranceOpted && !hasActiveInsurance) {
      insuranceCharge = 200.0;
    }

    const netAmount = parseFloat((totalAmount + taxAmount - discountAmount + insuranceCharge).toFixed(2));

    if (netAmount < 0) {
      throw new BadRequestException('Net amount cannot be negative');
    }

    // 3. Generate OrderNumber
    const count = await this.prisma.order.count();
    const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;

    // 4. Create Order + OrderItems in a transaction
    return this.prisma.$transaction(async (tx) => {
      // If insurance is opted and customer does not have active insurance, extend subscription by 1 year
      if (createOrderDto.insuranceOpted && !hasActiveInsurance) {
        const oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        await tx.customer.update({
          where: { id: customerId },
          data: { insuranceExpiry: oneYearLater },
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
          discountAmount,
          taxAmount,
          netAmount,
          notes,
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

      return order;
    });
  }

  async findAll() {
    return this.orderRepository.findAll({
      include: {
        customer: true,
        branch: true,
        orderItems: { include: { service: true } },
        payments: true,
        deliveries: true,
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
      },
      orderBy: { createdDate: 'desc' },
    });
  }
}
