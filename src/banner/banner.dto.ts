import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBannerDto {
  @ApiProperty({ example: 'Free Delivery', description: 'Banner title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'https://example.com/banner1.jpg', description: 'Banner image URL' })
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBannerDto {
  @ApiProperty({ example: 'Free Delivery', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'https://example.com/banner1.jpg', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
