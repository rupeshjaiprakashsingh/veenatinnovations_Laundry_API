import { IsOptional, IsString, IsEmail, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCustomerDto {
  @ApiProperty({ example: 'John', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'john.doe@email.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '9555555555', required: false })
  @IsString()
  @IsOptional()
  mobileNumber?: string;

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

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: 'Male', required: false })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiProperty({ example: '15/08/1995', required: false })
  @IsString()
  @IsOptional()
  dob?: string;

  @ApiProperty({ example: 'REF123', required: false })
  @IsString()
  @IsOptional()
  referralCode?: string;
}
