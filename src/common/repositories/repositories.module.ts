import { Module, Global } from '@nestjs/common';
import {
  BranchRepository,
  EmployeeRepository,
  CustomerRepository,
  ServiceRepository,
  ProductRepository,
  ServicePriceRepository,
  OrderRepository,
  PaymentRepository,
  PickupRequestRepository,
  DeliveryRepository,
  NotificationRepository,
  AddressRepository,
} from './laundry.repositories';

const repositories = [
  BranchRepository,
  EmployeeRepository,
  CustomerRepository,
  ServiceRepository,
  ProductRepository,
  ServicePriceRepository,
  OrderRepository,
  PaymentRepository,
  PickupRequestRepository,
  DeliveryRepository,
  NotificationRepository,
  AddressRepository,
];

@Global()
@Module({
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
