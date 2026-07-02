import { IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCouponDto {
  @ApiProperty({ example: 'FESTIVAL50' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @IsNotEmpty()
  discount!: number;

  @ApiProperty({ example: 'Festival special ₹50 off coupon', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCouponDto {
  @ApiProperty({ example: 'FESTIVAL50', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ example: 50.0, required: false })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiProperty({ example: 'Festival special ₹50 off coupon', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
