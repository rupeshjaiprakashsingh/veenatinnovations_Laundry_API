import { Controller, Get, Body, Put, Param, Delete, UseGuards, ParseIntPipe, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { UpdateCustomerDto } from './customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Customer Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get list of all customers (Staff only)' })
  findAll() {
    return this.customerService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer details by ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const { userId, role } = req.user;
    if (role === 'Customer' && userId !== id) {
      throw new ForbiddenException('You can only view your own details');
    }
    return this.customerService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer details' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Req() req: any,
  ) {
    const { userId, role } = req.user;
    if (role === 'Customer' && userId !== id) {
      throw new ForbiddenException('You can only update your own details');
    }
    return this.customerService.update(id, updateCustomerDto);
  }

  @Delete('all')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete all customers and dependent user data (SuperAdmin only)' })
  removeAll() {
    return this.customerService.removeAll();
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete a customer (SuperAdmin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.remove(id);
  }
}

