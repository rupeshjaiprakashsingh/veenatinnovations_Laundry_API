import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceService } from './service.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  CreateProductDto,
  UpdateProductDto,
  CreateServicePriceDto,
  UpdateServicePriceDto,
} from './service.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Service Management')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create a new service (SuperAdmin only)' })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.serviceService.create(createServiceDto);
  }

  @Public() // Anyone can browse laundry service pricing!
  @Get()
  @ApiOperation({ summary: 'Get list of all laundry services' })
  findAll() {
    return this.serviceService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get service details by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.findOne(id);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Update service details (SuperAdmin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateServiceDto: UpdateServiceDto) {
    return this.serviceService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete a service (SuperAdmin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.remove(id);
  }

  @Public()
  @Get('pricing/resolve')
  @ApiOperation({ summary: 'Get dynamic pricing with pincode overrides' })
  getPricing(@Query('pincode') pincode?: string) {
    return this.serviceService.getPricing(pincode);
  }

  // --- ADMIN PRODUCT ENDPOINTS ---
  @Get('admin/products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get list of all products (Admin only)' })
  findAllProducts() {
    return this.serviceService.findAllProducts();
  }

  @Post('admin/products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.serviceService.createProduct(dto);
  }

  @Put('admin/products/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Update a product (Admin only)' })
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.serviceService.updateProduct(id, dto);
  }

  @Delete('admin/products/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete a product (Admin only)' })
  removeProduct(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.removeProduct(id);
  }

  // --- ADMIN SERVICE PRICE ENDPOINTS ---
  @Get('admin/prices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get list of all service prices (Admin only)' })
  findAllServicePrices() {
    return this.serviceService.findAllServicePrices();
  }

  @Post('admin/prices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create a service price mapping (Admin only)' })
  createServicePrice(@Body() dto: CreateServicePriceDto) {
    return this.serviceService.createServicePrice(dto);
  }

  @Put('admin/prices/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Update a service price mapping (Admin only)' })
  updateServicePrice(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServicePriceDto) {
    return this.serviceService.updateServicePrice(id, dto);
  }

  @Delete('admin/prices/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete a service price mapping (Admin only)' })
  removeServicePrice(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.removeServicePrice(id);
  }
}
