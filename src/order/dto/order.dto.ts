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

  @ApiProperty({ example: 'YEARLY', required: false })
  @IsString()
  @IsOptional()
  insuranceType?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    example: 'Laundry',
    enum: [
      'New Order',
      'Picked Up',
      'Laundry',
      'Out For Delivery',
      'Delivered',
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

export class AssignShopDto {
  @ApiProperty({ example: 1, description: 'ID of the laundry shop to assign the order to' })
  @IsNumber()
  @IsNotEmpty()
  laundryShopId!: number;
}

export class BulkAssignShopDto {
  @ApiProperty({ example: [1, 2, 3], description: 'Array of order IDs to assign' })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  orderIds!: number[];

  @ApiProperty({ example: 1, description: 'ID of the laundry shop' })
  @IsNumber()
  @IsNotEmpty()
  laundryShopId!: number;
}

export class CreateTimeSlotDto {
  @ApiProperty({ example: '9 AM - 11 AM' })
  @IsString()
  @IsNotEmpty()
  slotName!: string;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @IsOptional()
  maxCapacity?: number;
}

export class UpdateTimeSlotDto {
  @ApiProperty({ example: '9 AM - 11 AM', required: false })
  @IsString()
  @IsOptional()
  slotName?: string;

  @ApiProperty({ example: 25, required: false })
  @IsNumber()
  @IsOptional()
  maxCapacity?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  isActive?: boolean;
}
