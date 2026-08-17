import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  orderId!: number;

  @ApiProperty({ example: 'Online', description: 'Cash, Card, Online, etc.' })
  @IsString()
  @IsNotEmpty()
  paymentMode!: string;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ example: 'TXN-123456', required: false })
  @IsString()
  @IsOptional()
  transactionReference?: string;
}

export class CreateRazorpayOrderDto {
  @ApiProperty({ example: 101, description: 'ID of the laundry order' })
  @IsNumber()
  @IsNotEmpty()
  orderId!: number;

  @ApiProperty({ example: 450.0, description: 'Amount in INR (Optional - defaults to order net amount)', required: false })
  @IsNumber()
  @IsOptional()
  amount?: number;
}

export class VerifyRazorpayPaymentDto {
  @ApiProperty({ example: 101, description: 'ID of the laundry order' })
  @IsNumber()
  @IsNotEmpty()
  orderId!: number;

  @ApiProperty({ example: 'order_M1234567890', description: 'Razorpay Order ID' })
  @IsString()
  @IsNotEmpty()
  razorpayOrderId!: string;

  @ApiProperty({ example: 'pay_M1234567890', description: 'Razorpay Payment ID' })
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId!: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6...', description: 'Cryptographic Razorpay Signature' })
  @IsString()
  @IsNotEmpty()
  razorpaySignature!: string;
}
