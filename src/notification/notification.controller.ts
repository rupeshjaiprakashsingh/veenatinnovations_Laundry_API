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
    const toEmail = (email || 'rupeshwork1727@gmail.com').trim();
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
