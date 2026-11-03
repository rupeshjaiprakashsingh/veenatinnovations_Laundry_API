import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  customerId!: number;

  @ApiProperty({ example: 'Your order is washing.' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({ example: 'Push', description: 'Email, SMS, Push, AdminMessage', required: false })
  @IsString()
  @IsOptional()
  notificationType?: string;

  @ApiProperty({ example: 560, required: false })
  @IsNumber()
  @IsOptional()
  orderId?: number;

  @ApiProperty({ example: 'ORD-00560', required: false })
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @ApiProperty({ example: 'Important Update on Your Order', required: false })
  @IsString()
  @IsOptional()
  title?: string;
}
