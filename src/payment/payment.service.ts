import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentRepository, OrderRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePaymentDto } from './payment.dto';
import { NotificationSenderService } from '../notification/notification-sender.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly orderRepository: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly notificationSender: NotificationSenderService,
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
        this.notificationSender.sendPaymentReceivedEmail(
          order.customer.email,
          order.customer.firstName,
          order.orderNumber,
          amount,
          paymentMode,
          transactionReference
        ).catch(err => {
          console.error('Payment receipt email failed:', err);
        });
      }

      return payment;
    });
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
