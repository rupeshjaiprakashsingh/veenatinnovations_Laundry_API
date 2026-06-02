import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Reporting & Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'BranchManager')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales/daily')
  @ApiOperation({ summary: 'Get daily sales revenue report' })
  getDailySales() {
    return this.reportsService.getDailySalesReport();
  }

  @Get('sales/monthly')
  @ApiOperation({ summary: 'Get monthly sales revenue report' })
  getMonthlySales() {
    return this.reportsService.getMonthlySalesReport();
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get customer analytics and spending report' })
  getCustomersReport() {
    return this.reportsService.getCustomerReport();
  }

  @Get('services')
  @ApiOperation({ summary: 'Get service performance and volume report' })
  getServicesReport() {
    return this.reportsService.getServiceWiseReport();
  }

  @Get('branches')
  @ApiOperation({ summary: 'Get branch wise order volume and sales report' })
  getBranchesReport() {
    return this.reportsService.getBranchWiseReport();
  }

  @Get('orders/pending')
  @ApiOperation({ summary: 'Get details of all uncompleted/pending orders' })
  getPendingOrders() {
    return this.reportsService.getPendingOrdersReport();
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'Get performance logs for delivery boys' })
  getDeliveryReport() {
    return this.reportsService.getDeliveryReport();
  }
}
