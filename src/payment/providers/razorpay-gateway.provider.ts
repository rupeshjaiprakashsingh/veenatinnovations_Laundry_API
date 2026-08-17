import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  IPaymentGatewayProvider,
  CreateGatewayOrderParams,
  GatewayOrderResult,
  VerifyGatewayPaymentParams,
} from '../interfaces/payment-gateway.interface';

// Dynamic import or require for Razorpay to prevent compile issues if optional
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');

@Injectable()
export class RazorpayGatewayProvider implements IPaymentGatewayProvider {
  private readonly logger = new Logger(RazorpayGatewayProvider.name);
  private instance: any;
  private keyId: string;
  private keySecret: string;

  constructor(private readonly configService: ConfigService) {
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || process.env.RAZORPAY_KEY_ID || 'rzp_test_key_id';
    this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret';

    try {
      this.instance = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
    } catch (err) {
      this.logger.error('Failed to initialize Razorpay instance:', err);
    }
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    const { orderId, amount, currency = 'INR', receipt, notes } = params;
    const amountInSubunits = Math.round(amount * 100); // INR to Paise

    const options = {
      amount: amountInSubunits,
      currency: currency.toUpperCase(),
      receipt: receipt || `rcpt_order_${orderId}_${Date.now()}`,
      notes: {
        orderId: String(orderId),
        ...(notes || {}),
      },
    };

    try {
      const razorpayOrder = await this.instance.orders.create(options);
      return {
        gatewayOrderId: razorpayOrder.id,
        amountInSubunits: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: this.keyId,
        receipt: razorpayOrder.receipt,
      };
    } catch (error: any) {
      this.logger.error(`Razorpay order creation failed for Order ID ${orderId}:`, error);
      throw new InternalServerErrorException(
        error.error?.description || error.message || 'Razorpay order creation failed',
      );
    }
  }

  verifyPaymentSignature(params: VerifyGatewayPaymentParams): boolean {
    const { gatewayOrderId, gatewayPaymentId, gatewaySignature } = params;
    if (!gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
      return false;
    }

    try {
      const body = `${gatewayOrderId}|${gatewayPaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(body)
        .digest('hex');

      return expectedSignature === gatewaySignature;
    } catch (error) {
      this.logger.error('Error verifying Razorpay payment signature:', error);
      return false;
    }
  }

  verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    if (!body || !signature || !secret) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      this.logger.error('Error verifying Razorpay webhook signature:', error);
      return false;
    }
  }
}
