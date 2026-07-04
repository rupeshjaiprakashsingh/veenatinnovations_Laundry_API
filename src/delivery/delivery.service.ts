import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DeliveryRepository, OrderRepository, EmployeeRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateDeliveryDto, UpdateDeliveryStatusDto } from './delivery.dto';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly orderRepository: OrderRepository,
    private readonly employeeRepository: EmployeeRepository,
    private readonly prisma: PrismaService,
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

    return this.prisma.$transaction(async (tx) => {
      const updatedDelivery = await tx.delivery.update({
        where: { id },
        data: {
          deliveryStatus: dto.deliveryStatus,
          deliveryRemarks: dto.deliveryRemarks ?? delivery.deliveryRemarks,
          deliveryDate: dto.deliveryStatus === 'Delivered' ? new Date() : delivery.deliveryDate,
        },
      });

      // If delivered, update order status to Delivered
      if (dto.deliveryStatus === 'Delivered') {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: {
            orderStatus: 'Delivered',
            deliveryDate: new Date(),
          },
        });
      } else if (dto.deliveryStatus === 'Failed') {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: {
            orderStatus: 'Ready For Delivery', // Fallback to ready
          },
        });
      }

      return updatedDelivery;
    });
  }

  async findByEmployee(employeeId: number) {
    return this.deliveryRepository.findAll({
      where: { deliveryEmployeeId: employeeId },
      include: { order: { include: { customer: true } } },
      orderBy: { id: 'desc' },
    });
  }
}
