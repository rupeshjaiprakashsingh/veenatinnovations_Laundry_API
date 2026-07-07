import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ example: 'Home', description: 'Title of the address (e.g. Home, Office, Other)' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'D wing 701 vaikunt dham j m road', description: 'Address line details' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: 'Bhandup west', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Maharashtra', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '400078', required: false })
  @IsString()
  @IsOptional()
  pincode?: string;

  @ApiProperty({ example: 'opposite j b d housing society', required: false })
  @IsString()
  @IsOptional()
  landmark?: string;

  @ApiProperty({ example: 'D wing 701', required: false })
  @IsString()
  @IsOptional()
  houseDetails?: string;

  @ApiProperty({ example: 19.076, required: false })
  @IsNumber()
  @IsOptional()
  lat?: number;

  @ApiProperty({ example: 72.8777, required: false })
  @IsNumber()
  @IsOptional()
  lng?: number;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @ApiProperty({ example: 'Office', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: '502 Meridian Business Centre', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Vashi', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Maharashtra', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '400703', required: false })
  @IsString()
  @IsOptional()
  pincode?: string;

  @ApiProperty({ example: 'Near Station', required: false })
  @IsString()
  @IsOptional()
  landmark?: string;

  @ApiProperty({ example: 'Flat 502', required: false })
  @IsString()
  @IsOptional()
  houseDetails?: string;

  @ApiProperty({ example: 19.076, required: false })
  @IsNumber()
  @IsOptional()
  lat?: number;

  @ApiProperty({ example: 72.8777, required: false })
  @IsNumber()
  @IsOptional()
  lng?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
