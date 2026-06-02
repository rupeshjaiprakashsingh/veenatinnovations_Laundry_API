import { Controller, Get, Post, Body, Put, Param, UseGuards, ParseIntPipe, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PickupService } from './pickup.service';
import { CreatePickupRequestDto, AssignPickupDto, UpdatePickupStatusDto } from './pickup.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Pickup Request Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pickup')
export class PickupController {
  constructor(private readonly pickupService: PickupService) {}

  @Post()
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'Customer')
  @ApiOperation({ summary: 'Create a new pickup request' })
  @ApiResponse({ status: 201, description: 'Pickup request created successfully' })
  async create(@Body() dto: CreatePickupRequestDto, @Req() req: any) {
    const { userId, role } = req.user;
    if (role === 'Customer' && dto.customerId !== userId) {
      throw new ForbiddenException('You can only request pick-ups for yourself');
    }
    return this.pickupService.create(dto);
  }

  @Get()
  @Roles('SuperAdmin', 'BranchManager', 'Employee')
  @ApiOperation({ summary: 'Get all pickup requests (Staff only)' })
  findAll() {
    return this.pickupService.findAll();
  }

  @Get('my-requests')
  @Roles('Customer')
  @ApiOperation({ summary: 'Get pickup requests of logged in customer' })
  findMyRequests(@Req() req: any) {
    return this.pickupService.findByCustomer(req.user.userId);
  }

  @Get('my-assignments')
  @Roles('Employee', 'DeliveryBoy')
  @ApiOperation({ summary: 'Get pickup requests assigned to current staff member' })
  findMyAssignments(@Req() req: any) {
    return this.pickupService.findByEmployee(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pickup request details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const { userId, role } = req.user;
    const request = await this.pickupService.findOne(id);
    if (role === 'Customer' && request.customerId !== userId) {
      throw new ForbiddenException('You can only view your own pickup requests');
    }
    return request;
  }

  @Put(':id/assign')
  @Roles('SuperAdmin', 'BranchManager')
  @ApiOperation({ summary: 'Assign pickup request to a delivery staff/employee (Admin/Manager only)' })
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignPickupDto) {
    return this.pickupService.assign(id, dto);
  }

  @Put(':id/status')
  @Roles('SuperAdmin', 'BranchManager', 'Employee', 'DeliveryBoy')
  @ApiOperation({ summary: 'Update pickup request status (Staff only)' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePickupStatusDto,
    @Req() req: any,
  ) {
    const { userId, role } = req.user;
    const request = await this.pickupService.findOne(id);
    
    // Delivery Boy can only update if they are assigned
    if (role === 'DeliveryBoy' && request.assignedEmployeeId !== userId) {
      throw new ForbiddenException('You can only update status for requests assigned to you');
    }
    
    return this.pickupService.updateStatus(id, dto);
  }
}
