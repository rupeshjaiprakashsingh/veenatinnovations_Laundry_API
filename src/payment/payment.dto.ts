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
