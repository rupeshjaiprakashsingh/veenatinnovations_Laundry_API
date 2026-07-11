import {
  Controller, Get, Post, Body, Put, Param, Delete,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BannerService } from './banner.service';
import { CreateBannerDto, UpdateBannerDto } from './banner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Banner Management')
@Controller('banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active banners (Android app uses this)' })
  findAll() {
    return this.bannerService.findAll(true);
  }

  @Get('admin/all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get all banners including inactive ones (Admin Panel only)' })
  findAllAdmin() {
    return this.bannerService.findAll(false);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create a new banner (SuperAdmin only)' })
  create(@Body() dto: CreateBannerDto) {
    return this.bannerService.create(dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Update a banner (SuperAdmin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBannerDto) {
    return this.bannerService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete a banner (SuperAdmin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.remove(id);
  }
}
