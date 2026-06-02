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
    const order = await this.orderRepository.findById(dto.orderId);
    if (!order) throw new NotFoundException(`Order with ID ${dto.orderId} not found`);

    const employee = await this.employeeRepository.findById(dto.deliveryEmployeeId);
    if (!employee) throw new NotFoundException(`Employee with ID ${dto.deliveryEmployeeId} not found`);
    if (employee.role !== 'DeliveryBoy' && employee.role !== 'Employee') {
      throw new BadRequestException('Delivery can only be assigned to DeliveryBoy or Employee roles');
    }

    return this.prisma.$transaction(async (tx) => {
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
