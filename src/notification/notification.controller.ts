import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './notification.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Notification Log Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

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
