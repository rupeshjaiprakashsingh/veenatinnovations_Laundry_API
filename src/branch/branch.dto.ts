import { IsNotEmpty, IsString, IsOptional, IsEmail, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ example: 'Main Branch HQ' })
  @IsString()
  @IsNotEmpty()
  branchName!: string;

  @ApiProperty({ example: 'BR-MAIN' })
  @IsString()
  @IsNotEmpty()
  branchCode!: string;

  @ApiProperty({ example: '123 Laundry St, Clean City', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsString()
  @IsOptional()
  contactNumber?: string;

  @ApiProperty({ example: 'hq@laundry.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBranchDto {
  @ApiProperty({ example: 'Main Branch HQ', required: false })
  @IsString()
  @IsOptional()
  branchName?: string;

  @ApiProperty({ example: 'BR-MAIN', required: false })
  @IsString()
  @IsOptional()
  branchCode?: string;

  @ApiProperty({ example: '123 Laundry St, Clean City', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsString()
  @IsOptional()
  contactNumber?: string;

  @ApiProperty({ example: 'hq@laundry.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
