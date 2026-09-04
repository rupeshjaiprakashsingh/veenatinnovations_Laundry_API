import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PickupRequestRepository, EmployeeRepository, CustomerRepository } from '../common/repositories/laundry.repositories';
import { CreatePickupRequestDto, AssignPickupDto, UpdatePickupStatusDto } from './pickup.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationSenderService } from '../notification/notification-sender.service';

@Injectable()
export class PickupService {
  constructor(
    private readonly pickupRepository: PickupRequestRepository,
    private readonly employeeRepository: EmployeeRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly prisma: PrismaService,
    private readonly notificationSender: NotificationSenderService,
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
    const pickups = await this.pickupRepository.findAll({
      include: { customer: true, assignedEmployee: true },
      orderBy: { pickupDate: 'desc' },
    });

    const enrichedPickups = await Promise.all(
      pickups.map(async (pickup) => {
        let activeOrder = await this.prisma.order.findFirst({
          where: {
            customerId: pickup.customerId,
            orderStatus: { in: ['New Order', 'Pickup Scheduled', 'Picked Up', 'Processing', 'Washing', 'Dry Cleaning', 'Ironing', 'Ready For Delivery', 'Out For Delivery', 'Delivered'] },
          },
          include: { laundryShop: true },
          orderBy: { id: 'desc' },
        });

        if (!activeOrder) {
          activeOrder = await this.prisma.order.findFirst({
            where: { customerId: pickup.customerId },
            include: { laundryShop: true },
            orderBy: { id: 'desc' },
          });
        }

        const generatedOrderNumber = `ORD-${String(pickup.id).padStart(5, '0')}`;

        // Compute resolved pickup address from the active order if available
        let resolvedAddress = pickup.pickupAddress;
        if (activeOrder && (activeOrder.address || activeOrder.houseDetails)) {
          const parts = [
            activeOrder.houseDetails,
            activeOrder.landmark ? `(Landmark: ${activeOrder.landmark})` : null,
            activeOrder.address,
            activeOrder.city,
            activeOrder.state,
            activeOrder.pincode,
          ].filter(Boolean);
          if (parts.length > 0) {
            resolvedAddress = parts.join(', ');
          }
        }

        return {
          ...pickup,
          pickupAddress: resolvedAddress,
          order: activeOrder
            ? {
                id: activeOrder.id,
                orderNumber: activeOrder.orderNumber || generatedOrderNumber,
                netAmount: activeOrder.netAmount,
                paymentStatus: activeOrder.paymentStatus,
                laundryShop: activeOrder.laundryShop,
                addressTitle: activeOrder.addressTitle,
                address: activeOrder.address,
                houseDetails: activeOrder.houseDetails,
                landmark: activeOrder.landmark,
                city: activeOrder.city,
                state: activeOrder.state,
                pincode: activeOrder.pincode,
              }
            : {
                id: pickup.id,
                orderNumber: generatedOrderNumber,
                netAmount: 0,
                paymentStatus: 'Pending',
                laundryShop: null,
                addressTitle: null,
                address: null,
                houseDetails: null,
                landmark: null,
                city: null,
                state: null,
                pincode: null,
              },
        };
      }),
    );

    return enrichedPickups;
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
          const updatedOrder = await tx.order.update({
            where: { id: activeOrder.id },
            data: {
              orderStatus: 'Picked Up',
              laundryShopId: dto.laundryShopId || undefined,
            },
            include: { customer: true },
          });

          // Create status history entry
          await tx.orderStatusHistory.create({
            data: {
              orderId: activeOrder.id,
              status: 'Picked Up',
            },
          });

          // Send Picked Up notification email
          if (updatedOrder.customer?.email) {
            this.notificationSender.sendOrderStatusUpdateEmail(
              updatedOrder.customer.email,
              updatedOrder.customer.firstName,
              updatedOrder.orderNumber,
              'Picked Up'
            ).catch(err => {
              console.error('Picked Up status email failed:', err);
            });
          }
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
    const pickups = await this.pickupRepository.findAll({
      where: { assignedEmployeeId: employeeId },
      include: { customer: true },
      orderBy: { pickupDate: 'desc' },
    });

    const enrichedPickups = await Promise.all(
      pickups.map(async (pickup) => {
        // If pickup is Completed or Cancelled, do not attach an unrelated newer active order!
        let activeOrder: any = null;
        if (pickup.status === 'Pending' || pickup.status === 'Assigned') {
          activeOrder = await this.prisma.order.findFirst({
            where: {
              customerId: pickup.customerId,
              orderStatus: { in: ['New Order', 'Pickup Scheduled'] },
            },
            include: { laundryShop: true },
            orderBy: { id: 'desc' },
          });

          if (!activeOrder) {
            activeOrder = await this.prisma.order.findFirst({
              where: {
                customerId: pickup.customerId,
                orderStatus: { in: ['Picked Up', 'Processing', 'Washing', 'Dry Cleaning', 'Ironing', 'Ready For Delivery'] },
              },
              include: { laundryShop: true },
              orderBy: { id: 'desc' },
            });
          }
        } else {
          // For completed/cancelled pickups, find order where status is Picked Up or beyond
          activeOrder = await this.prisma.order.findFirst({
            where: {
              customerId: pickup.customerId,
              orderStatus: { notIn: ['New Order', 'Pickup Scheduled'] },
            },
            include: { laundryShop: true },
            orderBy: { id: 'desc' },
          });
        }

        const generatedOrderNumber = `ORD-${String(pickup.id).padStart(5, '0')}`;

        // Compute resolved pickup address from the active order if available
        let resolvedAddress = pickup.pickupAddress;
        if (activeOrder && (activeOrder.address || activeOrder.houseDetails)) {
          const parts = [
            activeOrder.houseDetails,
            activeOrder.landmark ? `(Landmark: ${activeOrder.landmark})` : null,
            activeOrder.address,
            activeOrder.city,
            activeOrder.state,
            activeOrder.pincode,
          ].filter(Boolean);
          if (parts.length > 0) {
            resolvedAddress = parts.join(', ');
          }
        }

        return {
          ...pickup,
          pickupAddress: resolvedAddress,
          order: activeOrder
            ? {
                id: activeOrder.id,
                orderNumber: activeOrder.orderNumber || generatedOrderNumber,
                netAmount: activeOrder.netAmount,
                paymentStatus: activeOrder.paymentStatus,
                laundryShop: activeOrder.laundryShop,
                addressTitle: activeOrder.addressTitle,
                address: activeOrder.address,
                houseDetails: activeOrder.houseDetails,
                landmark: activeOrder.landmark,
                city: activeOrder.city,
                state: activeOrder.state,
                pincode: activeOrder.pincode,
              }
            : {
                id: pickup.id,
                orderNumber: generatedOrderNumber,
                netAmount: 0,
                paymentStatus: 'Pending',
                laundryShop: null,
                addressTitle: null,
                address: null,
                houseDetails: null,
                landmark: null,
                city: null,
                state: null,
                pincode: null,
              },
        };
      }),
    );

    return enrichedPickups;
  }
}
