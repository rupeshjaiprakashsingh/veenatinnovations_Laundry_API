import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, IsEnum, IsNumber, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@laundry.com', description: 'User email address' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'admin123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  password!: string;
}

export class RegisterCustomerDto {
  @ApiProperty({ example: 'John', description: 'Customer first name' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'Customer last name' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'john.doe@email.com', description: 'Customer email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '9555555555', description: 'Customer mobile number' })
  @IsString()
  @IsNotEmpty()
  mobileNumber!: string;

  @ApiProperty({ example: 'password123', description: 'Customer password' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  password!: string;

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
}

export class RegisterEmployeeDto {
  @ApiProperty({ example: 'Washing Specialist', description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'staff@laundry.com', description: 'Employee email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '9777777777', description: 'Employee mobile number' })
  @IsString()
  @IsNotEmpty()
  mobileNumber!: string;

  @ApiProperty({ example: 'Employee', enum: ['SuperAdmin', 'BranchManager', 'Employee', 'DeliveryBoy'] })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  branchId?: number;

  @ApiProperty({ example: 'staff123', description: 'Employee password' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @ApiProperty({ example: 'newAdminPassword123' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'customer@laundry.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'customer@laundry.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'some-reset-token-123' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'newPassword123' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  newPassword!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'refresh_token_here' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class PhoneLoginDto {
  @ApiProperty({ example: '9555555555', description: 'Customer mobile number' })
  @IsString()
  @IsNotEmpty()
  mobileNumber!: string;
}

export class TruecallerLoginDto {
  @ApiProperty({ example: '9555555555', description: 'Customer mobile number' })
  @IsString()
  @IsNotEmpty()
  mobileNumber!: string;

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
}
