import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailySalesReport() {
    const orders = await this.prisma.order.findMany({
      select: { createdDate: true, netAmount: true },
    });

    const report: Record<string, { date: string; revenue: number; orderCount: number }> = {};

    orders.forEach((o) => {
      const dateStr = o.createdDate.toISOString().split('T')[0];
      if (!report[dateStr]) {
        report[dateStr] = { date: dateStr, revenue: 0, orderCount: 0 };
      }
      report[dateStr].revenue = parseFloat((report[dateStr].revenue + o.netAmount).toFixed(2));
      report[dateStr].orderCount += 1;
    });

    return Object.values(report).sort((a, b) => b.date.localeCompare(a.date));
  }

  async getMonthlySalesReport() {
    const orders = await this.prisma.order.findMany({
      select: { createdDate: true, netAmount: true },
    });

    const report: Record<string, { month: string; revenue: number; orderCount: number }> = {};

    orders.forEach((o) => {
      const date = o.createdDate;
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!report[monthStr]) {
        report[monthStr] = { month: monthStr, revenue: 0, orderCount: 0 };
      }
      report[monthStr].revenue = parseFloat((report[monthStr].revenue + o.netAmount).toFixed(2));
      report[monthStr].orderCount += 1;
    });

    return Object.values(report).sort((a, b) => b.month.localeCompare(a.month));
  }

  async getCustomerReport() {
    const customers = await this.prisma.customer.findMany({
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
        email: true,
        orders: {
          select: { netAmount: true },
        },
      },
    });

    return customers.map((c) => {
      const orderCount = c.orders.length;
      const totalSpend = c.orders.reduce((sum, o) => sum + o.netAmount, 0);
      return {
        customerId: c.id,
        customerCode: c.customerCode,
        fullName: `${c.firstName} ${c.lastName}`,
        email: c.email,
        orderCount,
        totalSpend: parseFloat(totalSpend.toFixed(2)),
      };
    });
  }

  async getServiceWiseReport() {
    const services = await this.prisma.service.findMany({
      select: {
        id: true,
        serviceName: true,
        serviceType: true,
        orderItems: {
          select: { quantity: true, totalPrice: true },
        },
      },
    });

    return services.map((s) => {
      const quantitySold = s.orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenue = s.orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
      return {
        serviceId: s.id,
        serviceName: s.serviceName,
        serviceType: s.serviceType,
        quantitySold,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      };
    });
  }

  async getBranchWiseReport() {
    const branches = await this.prisma.branch.findMany({
      select: {
        id: true,
        branchName: true,
        branchCode: true,
        orders: {
          select: { netAmount: true },
        },
      },
    });

    return branches.map((b) => {
      const orderCount = b.orders.length;
      const totalRevenue = b.orders.reduce((sum, o) => sum + o.netAmount, 0);
      return {
        branchId: b.id,
        branchName: b.branchName,
        branchCode: b.branchCode,
        orderCount,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      };
    });
  }

  async getPendingOrdersReport() {
    return this.prisma.order.findMany({
      where: {
        orderStatus: {
          notIn: ['Delivered', 'Cancelled'],
        },
      },
      include: {
        customer: { select: { firstName: true, lastName: true, mobileNumber: true } },
        branch: { select: { branchName: true } },
      },
      orderBy: { createdDate: 'asc' },
    });
  }

  async getDeliveryReport() {
    const staff = await this.prisma.employee.findMany({
      where: { role: 'DeliveryBoy' },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        deliveries: {
          select: { deliveryStatus: true },
        },
      },
    });

    return staff.map((s) => {
      const totalDeliveries = s.deliveries.length;
      const completed = s.deliveries.filter((d) => d.deliveryStatus === 'Delivered').length;
      const pending = s.deliveries.filter((d) => ['Pending', 'OutForDelivery'].includes(d.deliveryStatus)).length;
      const failed = s.deliveries.filter((d) => d.deliveryStatus === 'Failed').length;
      return {
        employeeId: s.id,
        employeeCode: s.employeeCode,
        fullName: s.fullName,
        totalDeliveries,
        completed,
        pending,
        failed,
      };
    });
  }
}
