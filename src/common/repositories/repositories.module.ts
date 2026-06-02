import { Module, Global } from '@nestjs/common';
import {
  BranchRepository,
  EmployeeRepository,
  CustomerRepository,
  ServiceRepository,
  OrderRepository,
  PaymentRepository,
  PickupRequestRepository,
  DeliveryRepository,
  NotificationRepository,
} from './laundry.repositories';

const repositories = [
  BranchRepository,
  EmployeeRepository,
  CustomerRepository,
  ServiceRepository,
  OrderRepository,
  PaymentRepository,
  PickupRequestRepository,
  DeliveryRepository,
  NotificationRepository,
];

@Global()
@Module({
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
