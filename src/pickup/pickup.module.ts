import { Module } from '@nestjs/common';
import { PickupService } from './pickup.service';
import { PickupController } from './pickup.controller';

@Module({
  controllers: [PickupController],
  providers: [PickupService],
  exports: [PickupService],
})
export class PickupModule {}
