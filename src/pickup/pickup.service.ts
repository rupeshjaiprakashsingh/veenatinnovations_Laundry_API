import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PickupRequestRepository, EmployeeRepository, CustomerRepository } from '../common/repositories/laundry.repositories';
import { CreatePickupRequestDto, AssignPickupDto, UpdatePickupStatusDto } from './pickup.dto';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PickupService {
  constructor(
    private readonly pickupRepository: PickupRequestRepository,
    private readonly employeeRepository: EmployeeRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreatePickupRequestDto) {
    const customer = await this.customerRepository.findById(dto.customerId);
    if (!customer) throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);

    return this.pickupRepository.create({
      customerId: dto.customerId,
      pickupAddress: dto.pickupAddress,
      pickupDate: new Date(dto.pickupDate),
      pickupTime: dto.pickupTime,
      status: 'Pending',
    });
  }

  async findAll() {
    return this.pickupRepository.findAll({
      include: { customer: true, assignedEmployee: true },
      orderBy: { pickupDate: 'desc' },
    });
  }

  async findOne(id: number) {
    const request = await this.pickupRepository.findById(id);
    if (!request) throw new NotFoundException(`Pickup request with ID ${id} not found`);
    return request;
  }

  async assign(id: number, dto: AssignPickupDto) {
    await this.findOne(id); // Throws if not found

    const employee = await this.employeeRepository.findById(dto.assignedEmployeeId);
    if (!employee) throw new NotFoundException(`Employee with ID ${dto.assignedEmployeeId} not found`);
    if (employee.role !== 'DeliveryBoy' && employee.role !== 'Employee') {
      throw new BadRequestException('Can only assign pickup requests to DeliveryBoy or Employee roles');
    }

    return this.pickupRepository.update(id, {
      assignedEmployeeId: dto.assignedEmployeeId,
      status: 'Assigned',
    });
  }

  async updateStatus(id: number, dto: UpdatePickupStatusDto) {
    const pickup = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const updatedPickup = await tx.pickupRequest.update({
        where: { id },
        data: { status: dto.status },
      });

      if (dto.status === 'Completed') {
        // Find the active order for this customer in pickup phase (New Order or Pickup Scheduled)
        const activeOrder = await tx.order.findFirst({
          where: {
            customerId: pickup.customerId,
            orderStatus: { in: ['New Order', 'Pickup Scheduled'] },
          },
          orderBy: { id: 'desc' },
        });

        if (activeOrder) {
          // Update order status to Picked Up
          await tx.order.update({
            where: { id: activeOrder.id },
            data: {
              orderStatus: 'Picked Up',
              laundryShopId: dto.laundryShopId || undefined,
            },
          });

          // Create status history entry
          await tx.orderStatusHistory.create({
            data: {
              orderId: activeOrder.id,
              status: 'Picked Up',
            },
          });
        }
      }

      return updatedPickup;
    });
  }

  async findByCustomer(customerId: number) {
    return this.pickupRepository.findAll({
      where: { customerId },
      include: { assignedEmployee: true },
      orderBy: { pickupDate: 'desc' },
    });
  }

  async findByEmployee(employeeId: number) {
    return this.pickupRepository.findAll({
      where: { assignedEmployeeId: employeeId },
      include: { customer: true },
      orderBy: { pickupDate: 'desc' },
    });
  }
}
