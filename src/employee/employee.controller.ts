import { Controller, Get, Body, Put, Param, Delete, UseGuards, ParseIntPipe, ForbiddenException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { UpdateEmployeeDto } from './employee.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Employee Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  @Roles('SuperAdmin', 'BranchManager')
  @ApiOperation({ summary: 'Get list of all employees (Admin/Manager only)' })
  findAll() {
    return this.employeeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee details by ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const { userId, role } = req.user;
    if (role !== 'SuperAdmin' && role !== 'BranchManager' && userId !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }
    return this.employeeService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update employee details' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Req() req: any,
  ) {
    const { userId, role } = req.user;
    if (role !== 'SuperAdmin' && role !== 'BranchManager' && userId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.employeeService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Delete an employee (SuperAdmin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.remove(id);
  }
}
