import { Module } from '@nestjs/common';
import { PickupService } from './pickup.service';
import { PickupController } from './pickup.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [PickupController],
  providers: [PickupService],
  exports: [PickupService],
})
export class PickupModule {}
