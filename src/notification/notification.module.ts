import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationSenderService } from './notification-sender.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationSenderService],
  exports: [NotificationService, NotificationSenderService],
})
export class NotificationModule {}
