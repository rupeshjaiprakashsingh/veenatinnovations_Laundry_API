import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLegalContentDto {
  @ApiProperty({ example: 'Privacy Policy', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Content text or clauses...', description: 'Full legal text or markdown/HTML' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
