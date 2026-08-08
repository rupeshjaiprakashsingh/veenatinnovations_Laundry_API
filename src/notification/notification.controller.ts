import { Controller, Get, Post, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './notification.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { NotificationSenderService } from './notification-sender.service';

@ApiTags('Notification Log Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationSender: NotificationSenderService,
  ) {}

  @Public()
  @Get('test-email')
  @ApiOperation({ summary: 'Send a test email for SMTP verification (Public)' })
  async testEmail(@Query('email') email: string) {
    const toEmail = (email || 'rupeshsingh7208@gmail.com').trim();
    try {
      const info = await this.notificationSender.sendEmail(
        toEmail,
        'Grivana SMTP Verification Test',
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #4F46E5; text-align: center;">Grivana SMTP Setup Verified!</h2>
          <p>This is an automated test email sent to verify your SMTP server configuration on Render.</p>
          <p><strong>Recipient:</strong> ${toEmail}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p>If you received this email, it means the SMTP transporter is configured correctly and fully functional.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center;">© Grivana Laundry. All rights reserved.</p>
        </div>
        `
      );
      return {
        success: true,
        message: `Verification test email sent to ${toEmail}`,
        messageId: info?.messageId,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to send email to ${toEmail}`,
        error: err.message || err,
      };
    }
  }

  @Public()
  @Get('test-all-emails')
  @ApiOperation({ summary: 'Send test emails for all key events to a specified email address' })
  async testAllEmails(@Query('email') email: string) {
    const targetEmail = (email || 'rupeshsingh7208@gmail.com').trim();
    const name = 'Rupesh Singh';
    const orderNumber = 'ORD-TEST-' + Math.floor(1000 + Math.random() * 9000);
    const amount = 350;
    const items = [
      { clothType: 'Shirts (Dry Cleaning)', quantity: 2, service: { serviceName: 'Dry Cleaning' } },
      { clothType: 'Pants (Steam Press)', quantity: 3, service: { serviceName: 'Press / Ironing' } },
    ];

    const results: Record<string, any> = {};

    try {
      // 1. Welcome / Registration Email
      await this.notificationSender.sendRegistrationEmail(targetEmail, name);
      results['1_Registration'] = 'Sent';

      // 2. Order Confirmation Email
      await this.notificationSender.sendOrderCreatedEmail(targetEmail, name, orderNumber, amount, items);
      results['2_OrderCreated'] = 'Sent';

      // 3. Order Status Update Email (Picked Up)
      await this.notificationSender.sendOrderStatusUpdateEmail(targetEmail, name, orderNumber, 'Picked Up');
      results['3_OrderStatusPickedUp'] = 'Sent';

      // 4. Order Status Update Email (Out For Delivery)
      await this.notificationSender.sendOrderStatusUpdateEmail(targetEmail, name, orderNumber, 'Out For Delivery');
      results['4_OrderStatusOutForDelivery'] = 'Sent';

      // 5. Delivery OTP Email
      await this.notificationSender.sendDeliveryOtp(targetEmail, '918433711031', name, orderNumber, '4928');
      results['5_DeliveryOtp'] = 'Sent';

      // 6. Payment Confirmation Email
      await this.notificationSender.sendPaymentReceivedEmail(targetEmail, name, orderNumber, amount, 'UPI / GPay', 'UPI98421038521');
      results['6_PaymentReceived'] = 'Sent';

      // 7. Delivery Invoice Email
      await this.notificationSender.sendDeliveryInvoiceEmail(targetEmail, name, orderNumber, amount, items);
      results['7_DeliveryInvoice'] = 'Sent';

      return {
        success: true,
        message: `Sample emails for all key events successfully sent to ${targetEmail}`,
        orderNumber,
        eventsSent: results,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Error sending sample emails to ${targetEmail}`,
        error: err?.message || err,
        partialResults: results,
      };
    }
  }

  @Post()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Send/log a notification to a customer (Staff only)' })
  @ApiResponse({ status: 201, description: 'Notification logged successfully' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationService.create(dto);
  }

  @Get()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get all notifications (Staff only)' })
  findAll() {
    return this.notificationService.findAll();
  }

  @Get('my-notifications')
  @Roles('Customer')
  @ApiOperation({ summary: 'Get notifications for logged in customer' })
  findMyNotifications(@Req() req: any) {
    return this.notificationService.findByCustomer(req.user.userId);
  }
}
