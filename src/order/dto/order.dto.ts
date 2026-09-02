import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, ValidateNested, IsDateString, IsEnum, IsBoolean } from 'class-validator';
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

  @ApiProperty({ example: 'SAVE20', required: false })
  @IsString()
  @IsOptional()
  couponCode?: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  addressId?: number;

  @ApiProperty({ example: 'Home', required: false })
  @IsString()
  @IsOptional()
  addressTitle?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Clean City', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Hygiene State', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '400001', required: false })
  @IsString()
  @IsOptional()
  pincode?: string;

  @ApiProperty({ example: 'Near Mall', required: false })
  @IsString()
  @IsOptional()
  landmark?: string;

  @ApiProperty({ example: '102 Suite', required: false })
  @IsString()
  @IsOptional()
  houseDetails?: string;

  @ApiProperty({ example: 'Grivana Credits', required: false })
  @IsString()
  @IsOptional()
  paymentMode?: string;

  @ApiProperty({ example: 255.50, required: false })
  @IsNumber()
  @IsOptional()
  paidAmount?: number;

  @ApiProperty({ example: 'CREDIT-123456789', required: false })
  @IsString()
  @IsOptional()
  transactionReference?: string;
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

  @ApiProperty({ example: 'Cash', required: false, enum: ['Cash', 'UPI', 'Card', 'Online'] })
  @IsString()
  @IsOptional()
  paymentMode?: string;
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

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
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
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
