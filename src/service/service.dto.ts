import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ example: 'Standard Washing' })
  @IsString()
  @IsNotEmpty()
  serviceName!: string;

  @ApiProperty({ example: 'Washing' })
  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @ApiProperty({ example: 15.0 })
  @IsNumber()
  @IsNotEmpty()
  price!: number;

  @ApiProperty({ example: 'Thorough wash and dry cycle', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 24, required: false })
  @IsNumber()
  @IsOptional()
  estimatedHours?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateServiceDto {
  @ApiProperty({ example: 'Standard Washing', required: false })
  @IsString()
  @IsOptional()
  serviceName?: string;

  @ApiProperty({ example: 'Washing', required: false })
  @IsString()
  @IsOptional()
  serviceType?: string;

  @ApiProperty({ example: 15.0, required: false })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiProperty({ example: 'Thorough wash and dry cycle', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 24, required: false })
  @IsNumber()
  @IsOptional()
  estimatedHours?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
