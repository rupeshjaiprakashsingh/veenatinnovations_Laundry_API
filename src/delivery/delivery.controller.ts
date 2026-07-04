import { Controller, Get, Post, Body, Put, Param, UseGuards, ParseIntPipe, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto, UpdateDeliveryStatusDto } from './delivery.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderService } from '../order/order.service';

@ApiTags('Delivery Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('deliveries')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly orderService: OrderService,
  ) {}

  @Post()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Schedule a delivery / assign delivery boy (Staff only)' })
  @ApiResponse({ status: 201, description: 'Delivery scheduled successfully' })
  create(@Body() dto: CreateDeliveryDto) {
    return this.deliveryService.create(dto);
  }

  @Get()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get all delivery logs (Staff only)' })
  findAll() {
    return this.deliveryService.findAll();
  }

  @Get('my-deliveries')
  @Roles('Employee', 'DeliveryBoy')
  @ApiOperation({ summary: 'Get deliveries assigned to current delivery boy' })
  findMyDeliveries(@Req() req: any) {
    return this.deliveryService.findByEmployee(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get delivery details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const { userId, role } = req.user;
    const delivery = await this.deliveryService.findOne(id);
    if (role === 'Customer') {
      const order = await this.orderService.findOne(delivery.orderId);
      if (order.customerId !== userId) {
        throw new ForbiddenException('You can only view delivery details for your own orders');
      }
    }
    return delivery;
  }

  @Post(':id/request-otp')
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'DeliveryBoy')
  @ApiOperation({ summary: 'Request delivery verification OTP (Staff & assigned DeliveryBoy)' })
  async requestOtp(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const { userId, role } = req.user;
    const delivery = await this.deliveryService.findOne(id);

    if (role === 'DeliveryBoy' && delivery.deliveryEmployeeId !== userId) {
      throw new ForbiddenException('You can only request OTP for deliveries assigned to you');
    }

    return this.deliveryService.requestOtp(id);
  }

  @Put(':id/status')
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'DeliveryBoy')
  @ApiOperation({ summary: 'Update delivery status (Staff & assigned DeliveryBoy)' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryStatusDto,
    @Req() req: any,
  ) {
    const { userId, role } = req.user;
    const delivery = await this.deliveryService.findOne(id);

    if (role === 'DeliveryBoy' && delivery.deliveryEmployeeId !== userId) {
      throw new ForbiddenException('You can only update status for deliveries assigned to you');
    }

    return this.deliveryService.updateStatus(id, dto);
  }
}
