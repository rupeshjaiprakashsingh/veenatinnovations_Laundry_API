import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationRepository, CustomerRepository } from '../common/repositories/laundry.repositories';
import { CreateNotificationDto } from './notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly customerRepository: CustomerRepository,
  ) {}

  async create(dto: CreateNotificationDto) {
    const customer = await this.customerRepository.findById(dto.customerId);
    if (!customer) throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);

    return this.notificationRepository.create({
      customerId: dto.customerId,
      message: dto.message,
      notificationType: dto.notificationType,
      isSent: true,
      sentDate: new Date(),
    });
  }

  async findAll() {
    return this.notificationRepository.findAll({
      include: { customer: true },
      orderBy: { sentDate: 'desc' },
    });
  }

  async findByCustomer(customerId: number) {
    return this.notificationRepository.findAll({
      where: { customerId },
      orderBy: { sentDate: 'desc' },
    });
  }
}
