import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { PaymentRepository, OrderRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePaymentDto, CreateRazorpayOrderDto, VerifyRazorpayPaymentDto } from './payment.dto';
import { NotificationSenderService } from '../notification/notification-sender.service';
import type { IPaymentGatewayProvider } from './interfaces/payment-gateway.interface';
import { PAYMENT_GATEWAY_PROVIDER } from './interfaces/payment-gateway.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly orderRepository: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly notificationSender: NotificationSenderService,
    private readonly configService: ConfigService,
    @Inject(PAYMENT_GATEWAY_PROVIDER)
    private readonly gatewayProvider: any,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const { orderId, amount, paymentMode, transactionReference } = createPaymentDto;

    const order: any = await this.orderRepository.findDetailed(orderId);
    if (!order) throw new NotFoundException(`Order with ID ${orderId} not found`);

    return this.prisma.$transaction(async (tx) => {
      // Create Payment
      const payment = await tx.payment.create({
        data: {
          orderId,
          amount,
          paymentMode,
          transactionReference,
          paymentStatus: 'Completed',
        },
      });

      // Calculate total paid so far
      const allPayments = await tx.payment.findMany({
        where: { orderId, paymentStatus: 'Completed' },
      });
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

      // Determine order payment status
      let paymentStatus = 'Pending';
      if (totalPaid >= order.netAmount) {
        paymentStatus = 'Paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'Partially Paid';
      }

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus },
      });

      // Send payment receipt email
      if (order.customer?.email) {
        this.notificationSender
          .sendPaymentReceivedEmail(
            order.customer.email,
            order.customer.firstName,
            order.orderNumber,
            amount,
            paymentMode,
            transactionReference,
          )
          .catch((err) => {
            this.logger.error('Payment receipt email failed:', err);
          });
      }

      return payment;
    });
  }

  /**
   * Create Razorpay Gateway Order
   */
  async createRazorpayOrder(dto: CreateRazorpayOrderDto) {
    const { orderId, amount: requestedAmount } = dto;

    const order: any = await this.orderRepository.findDetailed(orderId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Calculate unpaid amount
    const completedPayments = await this.prisma.payment.findMany({
      where: { orderId, paymentStatus: 'Completed' },
    });
    const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, order.netAmount - totalPaid);

    if (remainingAmount <= 0) {
      throw new BadRequestException(`Order #${order.orderNumber} is already fully paid.`);
    }

    const payableAmount = requestedAmount && requestedAmount <= remainingAmount
      ? requestedAmount
      : remainingAmount;

    const gatewayResult = await this.gatewayProvider.createOrder({
      orderId,
      amount: payableAmount,
      currency: 'INR',
      receipt: `laundry_ord_${orderId}_${Date.now()}`,
      notes: {
        orderNumber: order.orderNumber,
        customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : '',
      },
    });

    return {
      success: true,
      orderId,
      orderNumber: order.orderNumber,
      payableAmount,
      razorpayOrderId: gatewayResult.gatewayOrderId,
      amountInPaise: gatewayResult.amountInSubunits,
      currency: gatewayResult.currency,
      keyId: gatewayResult.keyId,
    };
  }

  /**
   * Cryptographically verify Razorpay Payment and update database
   */
  async verifyRazorpayPayment(dto: VerifyRazorpayPaymentDto) {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = dto;

    // 1. Cryptographic signature check
    const isValid = this.gatewayProvider.verifyPaymentSignature({
      orderId,
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      gatewaySignature: razorpaySignature,
    });

    if (!isValid) {
      this.logger.warn(`Invalid Razorpay signature for Order ID ${orderId}, Razorpay Order ID: ${razorpayOrderId}`);
      throw new BadRequestException('Cryptographic payment verification failed. Invalid Razorpay signature.');
    }

    // 2. Fetch order
    const order: any = await this.orderRepository.findDetailed(orderId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // 3. Prevent duplicate payment processing for same transaction
    const existingTxn = await this.prisma.payment.findFirst({
      where: { transactionReference: razorpayPaymentId, paymentStatus: 'Completed' },
    });
    if (existingTxn) {
      return {
        message: 'Payment already processed successfully',
        payment: existingTxn,
      };
    }

    // 4. Calculate unpaid balance
    const completedPayments = await this.prisma.payment.findMany({
      where: { orderId, paymentStatus: 'Completed' },
    });
    const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const amountToPay = Math.max(0, order.netAmount - totalPaid);

    // 5. Update DB in atomic transaction
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId,
          amount: amountToPay > 0 ? amountToPay : order.netAmount,
          paymentMode: 'Online-Razorpay',
          transactionReference: razorpayPaymentId,
          paymentStatus: 'Completed',
        },
      });

      // Update Order Status
      const updatedAllPayments = await tx.payment.findMany({
        where: { orderId, paymentStatus: 'Completed' },
      });
      const newTotalPaid = updatedAllPayments.reduce((sum, p) => sum + p.amount, 0);

      let paymentStatus = 'Pending';
      if (newTotalPaid >= order.netAmount) {
        paymentStatus = 'Paid';
      } else if (newTotalPaid > 0) {
        paymentStatus = 'Partially Paid';
      }

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus },
      });

      // Send email notification asynchronously
      if (order.customer?.email) {
        this.notificationSender
          .sendPaymentReceivedEmail(
            order.customer.email,
            order.customer.firstName,
            order.orderNumber,
            payment.amount,
            'Online (Razorpay)',
            razorpayPaymentId,
          )
          .catch((err) => {
            this.logger.error('Payment receipt email failed:', err);
          });
      }

      return {
        message: 'Razorpay payment verified and processed successfully',
        orderId,
        orderNumber: order.orderNumber,
        paymentStatus,
        payment,
      };
    });
  }

  /**
   * Handle Razorpay Async Webhooks
   */
  async handleRazorpayWebhook(rawBody: string, signature: string) {
    const webhookSecret =
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET not configured. Webhook processing skipped.');
      return { status: 'ignored', reason: 'Webhook secret missing' };
    }

    const isValid = this.gatewayProvider.verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    const event = payload.event;
    this.logger.log(`Received Razorpay Webhook Event: ${event}`);

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      const razorpayPaymentId = paymentEntity?.id;
      const razorpayOrderId = paymentEntity?.order_id;
      const notes = paymentEntity?.notes || {};
      const orderId = notes.orderId ? parseInt(notes.orderId, 10) : null;

      if (orderId && razorpayPaymentId && razorpayOrderId) {
        try {
          await this.verifyRazorpayPayment({
            orderId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: '', // Bypass signature check for verified webhook calls
          });
        } catch (err: any) {
          this.logger.error(`Error processing webhook payment capture for Order #${orderId}:`, err);
        }
      }
    }

    return { status: 'processed' };
  }

  async findAll() {
    return this.paymentRepository.findAll({
      include: { order: true },
    });
  }

  async findByOrder(orderId: number) {
    return this.paymentRepository.findAll({
      where: { orderId },
    });
  }
}
