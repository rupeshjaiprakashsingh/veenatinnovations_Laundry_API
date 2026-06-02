import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderService } from '../order/order.service';

@ApiTags('Payment Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly orderService: OrderService,
  ) {}

  @Post()
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'Customer')
  @ApiOperation({ summary: 'Record a new payment transaction' })
  @ApiResponse({ status: 201, description: 'Payment recorded successfully' })
  async create(@Body() createPaymentDto: CreatePaymentDto, @Req() req: any) {
    const { userId, role } = req.user;
    if (role === 'Customer') {
      const order = await this.orderService.findOne(createPaymentDto.orderId);
      if (order.customerId !== userId) {
        throw new ForbiddenException('You can only make payments for your own orders');
      }
    }
    return this.paymentService.create(createPaymentDto);
  }

  @Get()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get all payment records (Staff only)' })
  findAll() {
    return this.paymentService.findAll();
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get payments associated with an order' })
  async findByOrder(@Param('orderId', ParseIntPipe) orderId: number, @Req() req: any) {
    const { userId, role } = req.user;
    if (role === 'Customer') {
      const order = await this.orderService.findOne(orderId);
      if (order.customerId !== userId) {
        throw new ForbiddenException('You can only view payments for your own orders');
      }
    }
    return this.paymentService.findByOrder(orderId);
  }
}
