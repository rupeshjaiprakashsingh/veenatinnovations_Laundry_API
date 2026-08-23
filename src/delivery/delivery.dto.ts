import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeliveryDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  orderId!: number;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsNotEmpty()
  deliveryEmployeeId!: number;

  @ApiProperty({ example: '2026-06-05T12:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  deliveryDate?: string;

  @ApiProperty({ example: 'Careful handling', required: false })
  @IsString()
  @IsOptional()
  deliveryRemarks?: string;
}

export class UpdateDeliveryStatusDto {
  @ApiProperty({ example: 'Delivered', enum: ['Pending', 'OutForDelivery', 'Delivered', 'Failed'] })
  @IsString()
  @IsNotEmpty()
  deliveryStatus!: string;

  @ApiProperty({ example: 'Delivered to customer directly', required: false })
  @IsString()
  @IsOptional()
  deliveryRemarks?: string;

  @ApiProperty({ example: '123456', required: false })
  @IsString()
  @IsOptional()
  deliveryOtp?: string;

  @ApiProperty({ example: 'UPI', required: false })
  @IsString()
  @IsOptional()
  paymentMode?: string;
}
