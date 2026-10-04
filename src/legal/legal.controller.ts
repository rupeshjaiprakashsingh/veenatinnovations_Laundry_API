import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LegalService } from './legal.service';
import { UpdateLegalContentDto } from './legal.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Legal & Policies')
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all legal contents (Privacy Policy, Terms of Use)' })
  findAll() {
    return this.legalService.findAll();
  }

  @Public()
  @Get(':key')
  @ApiOperation({ summary: 'Get legal content by key (e.g. privacy-policy, terms-of-use)' })
  findByKey(@Param('key') key: string) {
    return this.legalService.findByKey(key);
  }

  @Put(':key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'BranchManager')
  @ApiOperation({ summary: 'Update legal content by key (Admin only)' })
  update(@Param('key') key: string, @Body() dto: UpdateLegalContentDto) {
    return this.legalService.update(key, dto);
  }
}
