import {
  Controller, Get, Post, Body, Put, Param, Delete,
  UseGuards, ParseIntPipe, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LaundryShopService } from './laundry-shop.service';
import { CreateLaundryShopDto, UpdateLaundryShopDto } from './dto/laundry-shop.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Laundry Shop Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('laundry-shops')
export class LaundryShopController {
  constructor(private readonly laundryShopService: LaundryShopService) {}

  @Post()
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create a new laundry shop (SuperAdmin only)' })
  @ApiResponse({ status: 201, description: 'Laundry shop created successfully' })
  create(@Body() dto: CreateLaundryShopDto) {
    return this.laundryShopService.create(dto);
  }

  @Get()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get all laundry shops with stats' })
  findAll() {
    return this.laundryShopService.findAll();
  }

  @Get('suggest')
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Suggest laundry shops by customer pincode' })
  @ApiQuery({ name: 'pincode', required: true, example: '560034' })
  suggest(@Query('pincode') pincode: string) {
    return this.laundryShopService.suggestByPincode(pincode);
  }

  @Get(':id')
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get laundry shop details with all assigned orders' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.laundryShopService.findOne(id);
  }

  @Put(':id')
  @Roles('SuperAdmin', 'BranchManager')
  @ApiOperation({ summary: 'Update laundry shop details' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLaundryShopDto) {
    return this.laundryShopService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete a laundry shop (SuperAdmin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.laundryShopService.remove(id);
  }
}
