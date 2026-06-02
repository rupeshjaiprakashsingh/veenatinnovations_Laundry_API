import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
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

  @ApiProperty({ example: 'Push', description: 'Email, SMS, Push' })
  @IsString()
  @IsNotEmpty()
  notificationType!: string;
}
