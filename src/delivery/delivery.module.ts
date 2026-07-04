import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { OrderModule } from '../order/order.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [OrderModule, NotificationModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
