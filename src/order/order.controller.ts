import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards, ParseIntPipe, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto, UpdatePaymentStatusDto, AssignShopDto, BulkAssignShopDto, CreateTimeSlotDto, UpdateTimeSlotDto } from './dto/order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

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

  @Post('calculate')
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'Customer')
  @ApiOperation({ summary: 'Calculate/preview order bill' })
  calculateBill(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.calculateOrderBillDetails(createOrderDto);
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

  @Put(':id/assign-shop')
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Assign a single order to a laundry shop' })
  assignToShop(@Param('id', ParseIntPipe) id: number, @Body() assignShopDto: AssignShopDto) {
    return this.orderService.assignToShop(id, assignShopDto);
  }

  @Post('bulk-assign-shop')
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Bulk assign multiple orders to a laundry shop' })
  @ApiResponse({ status: 200, description: 'Orders assigned successfully' })
  bulkAssignToShop(@Body() bulkAssignDto: BulkAssignShopDto) {
    return this.orderService.bulkAssignToShop(bulkAssignDto);
  }

  // ── TIME SLOT MANAGEMENT ENDPOINTS ──

  @Public()
  @Get('time-slots/available')
  @ApiOperation({ summary: 'Get list of available time slots with their capacity status' })
  getAvailableSlots(
    @Query('date') date?: string,
    @Query('pincode') pincode?: string,
  ) {
    return this.orderService.getAvailableSlots(date, pincode);
  }

  @Get('time-slots/admin')
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get list of all time slots including inactive ones' })
  getTimeSlotsAdmin() {
    return this.orderService.getTimeSlotsAdmin();
  }

  @Post('time-slots')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create a new time slot' })
  createTimeSlot(@Body() dto: CreateTimeSlotDto) {
    return this.orderService.createTimeSlot(dto);
  }

  @Put('time-slots/:id')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Update a time slot' })
  updateTimeSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTimeSlotDto,
  ) {
    return this.orderService.updateTimeSlot(id, dto);
  }

  @Delete('time-slots/:id')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete a time slot' })
  deleteTimeSlot(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.deleteTimeSlot(id);
  }
}
