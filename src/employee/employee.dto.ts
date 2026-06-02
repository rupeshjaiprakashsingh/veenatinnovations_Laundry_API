import { IsOptional, IsString, IsEmail, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmployeeDto {
  @ApiProperty({ example: 'Super Admin Updated', required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ example: '9999999999', required: false })
  @IsString()
  @IsOptional()
  mobileNumber?: string;

  @ApiProperty({ example: 'admin@laundry.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'SuperAdmin', required: false })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  branchId?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
