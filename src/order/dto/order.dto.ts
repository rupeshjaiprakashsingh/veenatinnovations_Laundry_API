import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, ValidateNested, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  serviceId!: number;

  @ApiProperty({ example: 'Shirt' })
  @IsString()
  @IsNotEmpty()
  clothType!: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @IsNotEmpty()
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  customerId!: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  branchId!: number;

  @ApiProperty({ example: '2026-06-03T10:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  pickupDate?: string;

  @ApiProperty({ example: '2026-06-05T17:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  deliveryDate?: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  orderItems!: CreateOrderItemDto[];

  @ApiProperty({ example: 5.0, required: false })
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @ApiProperty({ example: 'Please handle silk items carefully.', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  insuranceOpted?: boolean;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    example: 'Processing',
    enum: [
      'New Order',
      'Pickup Scheduled',
      'Picked Up',
      'Processing',
      'Washing',
      'Dry Cleaning',
      'Ironing',
      'Ready For Delivery',
      'Out For Delivery',
      'Delivered',
      'Cancelled',
    ],
  })
  @IsString()
  @IsNotEmpty()
  orderStatus!: string;
}

export class UpdatePaymentStatusDto {
  @ApiProperty({ example: 'Paid', enum: ['Pending', 'Paid', 'Partially Paid'] })
  @IsString()
  @IsNotEmpty()
  paymentStatus!: string;
}
