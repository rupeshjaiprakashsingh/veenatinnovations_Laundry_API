import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { RepositoriesModule } from './common/repositories/repositories.module';
import { AuthModule } from './auth/auth.module';
import { BranchModule } from './branch/branch.module';
import { EmployeeModule } from './employee/employee.module';
import { CustomerModule } from './customer/customer.module';
import { ServiceModule } from './service/service.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { PickupModule } from './pickup/pickup.module';
import { DeliveryModule } from './delivery/delivery.module';
import { NotificationModule } from './notification/notification.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { LaundryShopModule } from './laundry-shop/laundry-shop.module';
import { CouponModule } from './coupon/coupon.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RepositoriesModule,
    AuthModule,
    BranchModule,
    EmployeeModule,
    CustomerModule,
    ServiceModule,
    OrderModule,
    PaymentModule,
    PickupModule,
    DeliveryModule,
    NotificationModule,
    DashboardModule,
    ReportsModule,
    LaundryShopModule,
    CouponModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
