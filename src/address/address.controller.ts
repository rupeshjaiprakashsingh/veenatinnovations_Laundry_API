import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AddressService } from './address.service';
import { CreateAddressDto, UpdateAddressDto } from './address.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Customer Address Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers/:customerId/addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  private validateAccess(customerId: number, req: any) {
    const { userId, role } = req.user;
    // Allow staff (SuperAdmin, BranchManager, Employee) to manage any customer's address
    const isStaff = ['SuperAdmin', 'BranchManager', 'Employee'].includes(role);
    if (!isStaff && userId !== customerId) {
      throw new ForbiddenException('You can only manage your own addresses');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get list of all addresses for a customer' })
  findAll(@Param('customerId', ParseIntPipe) customerId: number, @Req() req: any) {
    this.validateAccess(customerId, req);
    return this.addressService.findAll(customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific address' })
  findOne(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    this.validateAccess(customerId, req);
    return this.addressService.findOne(id, customerId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new address for a customer' })
  create(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() createAddressDto: CreateAddressDto,
    @Req() req: any,
  ) {
    this.validateAccess(customerId, req);
    return this.addressService.create(customerId, createAddressDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update address details' })
  update(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAddressDto: UpdateAddressDto,
    @Req() req: any,
  ) {
    this.validateAccess(customerId, req);
    return this.addressService.update(id, customerId, updateAddressDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address' })
  remove(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    this.validateAccess(customerId, req);
    return this.addressService.remove(id, customerId);
  }
}
