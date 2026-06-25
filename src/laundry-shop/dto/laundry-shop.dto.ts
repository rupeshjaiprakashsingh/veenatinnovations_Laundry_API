import { IsNotEmpty, IsString, IsOptional, IsEmail, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLaundryShopDto {
  @ApiProperty({ example: 'Sunrise Laundry' })
  @IsString()
  @IsNotEmpty()
  shopName!: string;

  @ApiProperty({ example: 'SL-001' })
  @IsString()
  @IsNotEmpty()
  shopCode!: string;

  @ApiProperty({ example: 'Rajesh Kumar', required: false })
  @IsString()
  @IsOptional()
  ownerName?: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsString()
  @IsOptional()
  contactNumber?: string;

  @ApiProperty({ example: 'sunrise@laundry.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '12 MG Road, Koramangala', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Bangalore', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Karnataka', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '560034', required: false })
  @IsString()
  @IsOptional()
  pincode?: string;

  @ApiProperty({ example: 50, required: false, description: 'Max orders per day' })
  @IsNumber()
  @IsOptional()
  capacity?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateLaundryShopDto {
  @ApiProperty({ example: 'Sunrise Laundry', required: false })
  @IsString()
  @IsOptional()
  shopName?: string;

  @ApiProperty({ example: 'SL-001', required: false })
  @IsString()
  @IsOptional()
  shopCode?: string;

  @ApiProperty({ example: 'Rajesh Kumar', required: false })
  @IsString()
  @IsOptional()
  ownerName?: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsString()
  @IsOptional()
  contactNumber?: string;

  @ApiProperty({ example: 'sunrise@laundry.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '12 MG Road, Koramangala', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Bangalore', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Karnataka', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '560034', required: false })
  @IsString()
  @IsOptional()
  pincode?: string;

  @ApiProperty({ example: 50, required: false })
  @IsNumber()
  @IsOptional()
  capacity?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
