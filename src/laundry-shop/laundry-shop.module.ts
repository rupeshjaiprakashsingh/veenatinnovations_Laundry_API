import { Module } from '@nestjs/common';
import { LaundryShopService } from './laundry-shop.service';
import { LaundryShopController } from './laundry-shop.controller';

@Module({
  controllers: [LaundryShopController],
  providers: [LaundryShopService],
  exports: [LaundryShopService],
})
export class LaundryShopModule {}
