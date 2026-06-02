import { Controller, Get, Post, Body, Put, Param, UseGuards, ParseIntPipe, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto, UpdatePaymentStatusDto } from './dto/order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Order Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'Customer')
  @ApiOperation({ summary: 'Create a new laundry order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  create(@Body() createOrderDto: CreateOrderDto, @Req() req: any) {
    const { userId, role } = req.user;
    // Customer can only create orders for themselves
    if (role === 'Customer' && createOrderDto.customerId !== userId) {
      throw new ForbiddenException('You can only create orders for yourself');
    }
    return this.orderService.create(createOrderDto);
  }

  @Get()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get all orders (Staff only)' })
  findAll() {
    return this.orderService.findAll();
  }

  @Get('my-orders')
  @Roles('Customer')
  @ApiOperation({ summary: 'Get orders of currently logged in customer' })
  findMyOrders(@Req() req: any) {
    return this.orderService.findByCustomer(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const { userId, role } = req.user;
    const order = await this.orderService.findOne(id);
    if (role === 'Customer' && order.customerId !== userId) {
      throw new ForbiddenException('You are not authorized to view this order');
    }
    return order;
  }

  @Put(':id/status')
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Update order status workflow (Staff only)' })
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() updateStatusDto: UpdateOrderStatusDto) {
    return this.orderService.updateStatus(id, updateStatusDto);
  }

  @Put(':id/payment-status')
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Update order payment status (Staff only)' })
  updatePaymentStatus(@Param('id', ParseIntPipe) id: number, @Body() updatePaymentStatusDto: UpdatePaymentStatusDto) {
    return this.orderService.updatePaymentStatus(id, updatePaymentStatusDto);
  }
}
