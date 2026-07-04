import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePickupRequestDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  customerId!: number;

  @ApiProperty({ example: '456 Main Rd, Clean City' })
  @IsString()
  @IsNotEmpty()
  pickupAddress!: string;

  @ApiProperty({ example: '2026-06-03T09:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  pickupDate!: string;

  @ApiProperty({ example: '10:00 AM - 12:00 PM' })
  @IsString()
  @IsNotEmpty()
  pickupTime!: string;
}

export class AssignPickupDto {
  @ApiProperty({ example: 3 })
  @IsNumber()
  @IsNotEmpty()
  assignedEmployeeId!: number;
}

export class UpdatePickupStatusDto {
  @ApiProperty({ example: 'Completed', enum: ['Pending', 'Assigned', 'Completed', 'Cancelled'] })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  laundryShopId?: number;
}
