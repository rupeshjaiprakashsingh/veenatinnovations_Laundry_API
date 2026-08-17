import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { OrderModule } from '../order/order.module';
import { NotificationModule } from '../notification/notification.module';
import { PAYMENT_GATEWAY_PROVIDER } from './interfaces/payment-gateway.interface';
import { RazorpayGatewayProvider } from './providers/razorpay-gateway.provider';

@Module({
  imports: [OrderModule, NotificationModule, ConfigModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    RazorpayGatewayProvider,
    {
      provide: PAYMENT_GATEWAY_PROVIDER,
      useClass: RazorpayGatewayProvider,
    },
  ],
  exports: [PaymentService, PAYMENT_GATEWAY_PROVIDER],
})
export class PaymentModule {}
