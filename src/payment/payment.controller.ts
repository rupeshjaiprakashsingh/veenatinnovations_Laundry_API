import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Req,
  ForbiddenException,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, CreateRazorpayOrderDto, VerifyRazorpayPaymentDto } from './payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderService } from '../order/order.service';

@ApiTags('Payment Management')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly orderService: OrderService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'Customer')
  @ApiOperation({ summary: 'Record a new payment transaction (Manual/Cash/Online)' })
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

  @Post('razorpay/create-order')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'Customer')
  @ApiOperation({ summary: 'Create a Razorpay Order ID for checkout' })
  @ApiResponse({ status: 201, description: 'Razorpay order created successfully' })
  async createRazorpayOrder(@Body() dto: CreateRazorpayOrderDto, @Req() req: any) {
    const { userId, role } = req.user;
    if (role === 'Customer') {
      const order = await this.orderService.findOne(dto.orderId);
      if (order.customerId !== userId) {
        throw new ForbiddenException('You can only pay for your own orders');
      }
    }
    return this.paymentService.createRazorpayOrder(dto);
  }

  @Post('razorpay/verify')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'Customer')
  @ApiOperation({ summary: 'Verify Razorpay payment signature & update database' })
  @ApiResponse({ status: 200, description: 'Razorpay payment verified successfully' })
  async verifyRazorpayPayment(@Body() dto: VerifyRazorpayPaymentDto, @Req() req: any) {
    const { userId, role } = req.user;
    if (role === 'Customer') {
      const order = await this.orderService.findOne(dto.orderId);
      if (order.customerId !== userId) {
        throw new ForbiddenException('You can only verify payments for your own orders');
      }
    }
    return this.paymentService.verifyRazorpayPayment(dto);
  }

  @Post('razorpay/webhook')
  @ApiOperation({ summary: 'Razorpay Webhook endpoint for async event processing' })
  async razorpayWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    return this.paymentService.handleRazorpayWebhook(rawBody, signature);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get all payment records (Staff only)' })
  findAll() {
    return this.paymentService.findAll();
  }

  @Get('order/:orderId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
