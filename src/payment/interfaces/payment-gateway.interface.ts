export interface CreateGatewayOrderParams {
  orderId: number;
  amount: number; // in main currency unit (e.g. INR)
  currency?: string;
  receipt?: string;
  notes?: Record<string, any>;
}

export interface GatewayOrderResult {
  gatewayOrderId: string;
  amountInSubunits: number; // Amount in paise for INR
  currency: string;
  keyId: string;
  receipt: string;
}

export interface VerifyGatewayPaymentParams {
  orderId: number;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
}

export interface IPaymentGatewayProvider {
  /**
   * Generates a new order on the Payment Gateway.
   */
  createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult>;

  /**
   * Cryptographically verifies the payment signature returned by the client.
   */
  verifyPaymentSignature(params: VerifyGatewayPaymentParams): boolean;

  /**
   * Cryptographically verifies asynchronous webhook payload signatures.
   */
  verifyWebhookSignature(body: string, signature: string, secret: string): boolean;
}

export const PAYMENT_GATEWAY_PROVIDER = 'PAYMENT_GATEWAY_PROVIDER';
