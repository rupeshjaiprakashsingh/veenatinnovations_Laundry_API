import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BasePrismaRepository } from './base.prisma.repository';
import {
  Branch,
  Employee,
  Customer,
  Service,
  Order,
  Payment,
  PickupRequest,
  Delivery,
  Notification,
  Product,
  ServicePrice,
  Address,
} from '@prisma/client';

@Injectable()
export class BranchRepository extends BasePrismaRepository<Branch> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.branch);
  }
}

@Injectable()
export class EmployeeRepository extends BasePrismaRepository<Employee> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.employee);
  }

  async findByEmail(email: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({
      where: { email },
      include: { branch: true },
    });
  }
}

@Injectable()
export class CustomerRepository extends BasePrismaRepository<Customer> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.customer);
  }

  override async findById(id: number): Promise<any | null> {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          orderBy: { createdDate: 'desc' },
          include: {
            orderItems: { include: { service: true } },
            payments: true,
          }
        }
      }
    });
  }

  async findByEmail(email: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: { email },
    });
  }
}

@Injectable()
export class ServiceRepository extends BasePrismaRepository<Service> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.service);
  }
}

@Injectable()
export class ProductRepository extends BasePrismaRepository<Product> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.product);
  }
}

@Injectable()
export class ServicePriceRepository extends BasePrismaRepository<ServicePrice> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.servicePrice);
  }
}

@Injectable()
export class OrderRepository extends BasePrismaRepository<Order> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.order);
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: true,
        branch: true,
        orderItems: {
          include: { service: true }
        },
        payments: true,
        deliveries: true,
        statusHistory: {
          orderBy: { createdDate: 'asc' }
        },
      },
    });
  }

  async findDetailed(id: number): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        branch: true,
        orderItems: {
          include: { service: true }
        },
        payments: true,
        deliveries: true,
        statusHistory: {
          orderBy: { createdDate: 'asc' }
        },
      },
    });
  }
}

@Injectable()
export class PaymentRepository extends BasePrismaRepository<Payment> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.payment);
  }
}

@Injectable()
export class PickupRequestRepository extends BasePrismaRepository<PickupRequest> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.pickupRequest);
  }
}

@Injectable()
export class DeliveryRepository extends BasePrismaRepository<Delivery> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.delivery);
  }
}

@Injectable()
export class NotificationRepository extends BasePrismaRepository<Notification> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.notification);
  }
}

@Injectable()
export class AddressRepository extends BasePrismaRepository<Address> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.address);
  }
}

