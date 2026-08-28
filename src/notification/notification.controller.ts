import { Controller, Get, Post, Body, UseGuards, Req, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './notification.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { NotificationSenderService } from './notification-sender.service';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Notification Log Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationSender: NotificationSenderService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('test-email')
  @ApiOperation({ summary: 'Send a test email for SMTP verification (Public)' })
  async testEmail(@Query('email') email: string) {
    const toEmail = (email || '').trim();
    if (!toEmail || !toEmail.includes('@')) {
      throw new BadRequestException('Please provide a valid recipient email query parameter: ?email=user@domain.com');
    }
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
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send email to ${toEmail}`,
        error: err.message || err,
      };
    }
  }

  @Public()
  @Get('send-otp')
  @ApiOperation({ summary: 'Send 4-digit OTP email & SMS to customer (Public)' })
  async sendOtp(@Query('email') email: string, @Query('otp') otp: string, @Query('mobile') mobile: string) {
    let toEmail = (email || '').trim();
    const otpCode = (otp || '1234').trim();

    // If mobile number is provided, strictly lookup that specific customer from database
    if (mobile && mobile.trim().length > 0) {
      const cleanMobile = mobile.replace(/[^0-9]/g, '');
      const raw10 = cleanMobile.length >= 10 ? cleanMobile.slice(-10) : cleanMobile;
      const customer = await this.prisma.customer.findFirst({
        where: {
          OR: [
            { mobileNumber: raw10 },
            { mobileNumber: `+91${raw10}` },
            { mobileNumber: `91${raw10}` },
          ],
        },
      });
      // Use email ONLY if it matches the registered customer for this mobile
      if (customer && customer.email && customer.email.includes('@')) {
        toEmail = customer.email.trim();
      } else {
        // New user / unregistered mobile: do NOT send email to any mismatched address
        toEmail = '';
      }
    }

    try {
      let info: any = null;
      if (toEmail && toEmail.includes('@')) {
        info = await this.notificationSender.sendEmail(
          toEmail,
          `Your Grivana Login OTP: ${otpCode}`,
          `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px; background-color: #EEF2FF; padding: 15px; border-radius: 8px;">
              <h2 style="color: #4F46E5; margin: 0; font-size: 20px;">Grivana OTP Verification</h2>
            </div>
            <p style="color: #334155; font-size: 14px;">Dear Customer,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.5;">Your 4-digit verification code to log in to Grivana Laundry app is:</p>
            
            <div style="background-color: #FFFBEB; border: 2px dashed #F59E0B; color: #B45309; text-align: center; font-size: 32px; font-weight: bold; padding: 15px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
              ${otpCode}
            </div>
            
            <p style="color: #64748B; font-size: 12px; text-align: center;">This code is valid for 10 minutes. Do not share this OTP with anyone.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">© Grivana Laundry. All rights reserved.</p>
          </div>
          `
        );
      }

      if (mobile) {
        await this.notificationSender.sendOtpSMS(mobile, otpCode);
      }

      return {
        success: true,
        message: toEmail ? `OTP ${otpCode} sent to ${toEmail}` : `OTP ${otpCode} sent via SMS to ${mobile}`,
        messageId: info?.messageId,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send OTP to ${toEmail || mobile}`,
        error: err?.message || err,
      };
    }
  }

  @Public()
  @Get('test-all-emails')
  @ApiOperation({ summary: 'Send test emails for all key events to a specified email address' })
  async testAllEmails(@Query('email') email: string) {
    const targetEmail = (email || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      throw new BadRequestException('Please provide a valid target recipient email: ?email=user@domain.com');
    }
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
