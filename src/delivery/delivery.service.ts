import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DeliveryRepository, OrderRepository, EmployeeRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateDeliveryDto, UpdateDeliveryStatusDto } from './delivery.dto';
import { NotificationSenderService } from '../notification/notification-sender.service';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly orderRepository: OrderRepository,
    private readonly employeeRepository: EmployeeRepository,
    private readonly prisma: PrismaService,
    private readonly notificationSender: NotificationSenderService,
  ) {}

  async create(dto: CreateDeliveryDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { customer: true },
    });
    if (!order) throw new NotFoundException(`Order with ID ${dto.orderId} not found`);

    const employee = await this.employeeRepository.findById(dto.deliveryEmployeeId);
    if (!employee) throw new NotFoundException(`Employee with ID ${dto.deliveryEmployeeId} not found`);
    if (employee.role !== 'DeliveryBoy' && employee.role !== 'Employee') {
      throw new BadRequestException('Delivery can only be assigned to DeliveryBoy or Employee roles');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. If order status is "New Order" or "Pickup Scheduled", it is a PICKUP request assignment
      if (order.orderStatus === 'New Order' || order.orderStatus === 'Pickup Scheduled') {
        let pickup = await tx.pickupRequest.findFirst({
          where: {
            customerId: order.customerId,
            status: { in: ['Pending', 'Assigned'] },
          },
        });

        if (pickup) {
          pickup = await tx.pickupRequest.update({
            where: { id: pickup.id },
            data: {
              assignedEmployeeId: dto.deliveryEmployeeId,
              status: 'Assigned',
            },
          });
        } else {
          const pickupAddress = [
            order.customer?.houseDetails,
            order.customer?.landmark,
            order.customer?.address,
            order.customer?.city,
            order.customer?.pincode,
          ]
            .filter(Boolean)
            .join(', ') || 'Customer Address';

          pickup = await tx.pickupRequest.create({
            data: {
              customerId: order.customerId,
              pickupAddress,
              pickupDate: order.pickupDate ? new Date(order.pickupDate) : new Date(),
              pickupTime: order.notes?.includes('Slot:')
                ? order.notes.split('|').find((p) => p.includes('Slot:'))?.replace('Slot:', '').trim() || 'Anytime'
                : 'Anytime',
              status: 'Assigned',
              assignedEmployeeId: dto.deliveryEmployeeId,
            },
          });
        }

        // Update order status to Pickup Scheduled
        await tx.order.update({
          where: { id: dto.orderId },
          data: { orderStatus: 'Pickup Scheduled' },
        });

        // Add to order status history
        await tx.orderStatusHistory.create({
          data: {
            orderId: dto.orderId,
            status: 'Pickup Scheduled',
          },
        });

        // Automatically pre-create/update the Delivery record so the delivery boy is assigned for both pickup and delivery phase
        const existingDelivery = await tx.delivery.findFirst({
          where: { orderId: dto.orderId },
        });

        if (!existingDelivery) {
          await tx.delivery.create({
            data: {
              orderId: dto.orderId,
              deliveryEmployeeId: dto.deliveryEmployeeId,
              deliveryStatus: 'Pending',
              deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
              deliveryRemarks: dto.deliveryRemarks,
            },
          });
        } else {
          await tx.delivery.update({
            where: { id: existingDelivery.id },
            data: {
              deliveryEmployeeId: dto.deliveryEmployeeId,
              deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
              deliveryRemarks: dto.deliveryRemarks,
            },
          });
        }

        return pickup;
      }

      // 2. Otherwise (Ready For Delivery, Out For Delivery, etc.), it is a DELIVERY assignment
      const delivery = await tx.delivery.create({
        data: {
          orderId: dto.orderId,
          deliveryEmployeeId: dto.deliveryEmployeeId,
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
          deliveryStatus: 'Pending',
          deliveryRemarks: dto.deliveryRemarks,
        },
      });

      // Update order status to Out For Delivery since it is assigned and created
      await tx.order.update({
        where: { id: dto.orderId },
        data: { orderStatus: 'Out For Delivery' },
      });

      // Add to order status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: dto.orderId,
          status: 'Out For Delivery',
        },
      });

      return delivery;
    });
  }

  async findAll() {
    return this.deliveryRepository.findAll({
      include: { order: { include: { customer: true } }, deliveryEmployee: true },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const delivery = await this.deliveryRepository.findById(id);
    if (!delivery) throw new NotFoundException(`Delivery record with ID ${id} not found`);
    return delivery;
  }

  async updateStatus(id: number, dto: UpdateDeliveryStatusDto) {
    const delivery = await this.findOne(id);

    if (dto.deliveryStatus === 'Delivered') {
      if (!dto.deliveryOtp) {
        throw new BadRequestException('Delivery completion OTP is required');
      }
      if (delivery.deliveryOtp !== dto.deliveryOtp) {
        throw new BadRequestException('Invalid delivery completion OTP');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedDelivery = await tx.delivery.update({
        where: { id },
        data: {
          deliveryStatus: dto.deliveryStatus,
          deliveryRemarks: dto.deliveryRemarks ?? delivery.deliveryRemarks,
          deliveryDate: dto.deliveryStatus === 'Delivered' ? new Date() : delivery.deliveryDate,
          deliveryOtp: dto.deliveryStatus === 'Delivered' ? null : delivery.deliveryOtp,
        },
      });

      // If delivered, update order status to Delivered
      if (dto.deliveryStatus === 'Delivered') {
        const order = await tx.order.update({
          where: { id: delivery.orderId },
          data: {
            orderStatus: 'Delivered',
            deliveryDate: new Date(),
          },
          include: { customer: true, orderItems: { include: { service: true } } },
        });

        // Trigger SMS & Email notification here: send invoice and order details!
        this.notificationSender.sendInvoiceEmail(
          order.customer.email,
          order.customer.firstName,
          order.orderNumber,
          order.netAmount,
          order.orderItems
        ).catch(err => {
          console.error('Invoice delivery email failed:', err);
        });

        this.notificationSender.sendSMS(
          order.customer.mobileNumber,
          `Veena Innovations Laundry: Your order #${order.orderNumber} has been delivered successfully. Paid Amount: ₹${order.netAmount}. Thank you!`
        ).catch(err => {
          console.error('Invoice delivery SMS failed:', err);
        });

      } else if (dto.deliveryStatus === 'Failed') {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: {
            orderStatus: 'Laundry', // Fallback to laundry
          },
        });
      }

      return updatedDelivery;
    });
  }

  async requestOtp(id: number) {
    const delivery = await this.findOne(id);
    const order = await this.prisma.order.findUnique({
      where: { id: delivery.orderId },
      include: { customer: true },
    });

    if (!order) throw new NotFoundException(`Order for delivery ID ${id} not found`);

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await this.prisma.delivery.update({
      where: { id },
      data: { deliveryOtp: otp },
    });

    // Send OTP via SMS & Email
    this.notificationSender.sendDeliveryOtp(
      order.customer.email,
      order.customer.mobileNumber,
      order.customer.firstName,
      order.orderNumber,
      otp
    ).catch(err => {
      console.error('Failed to send delivery verification OTP:', err);
    });

    return {
      message: 'Delivery verification OTP has been sent to the customer.',
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  async findByEmployee(employeeId: number) {
    return this.deliveryRepository.findAll({
      where: { deliveryEmployeeId: employeeId },
      include: { order: { include: { customer: true } } },
      orderBy: { id: 'desc' },
    });
  }
}
