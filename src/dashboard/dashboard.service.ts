import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Total Customers
    const totalCustomers = await this.prisma.customer.count({ where: { isActive: true } });

    // 2. Total Orders
    const totalOrders = await this.prisma.order.count();

    // 3. Total Revenue
    const revenueAgg = await this.prisma.order.aggregate({
      _sum: { netAmount: true },
    });
    const totalRevenue = revenueAgg._sum.netAmount || 0;

    // 4. Pending Deliveries
    const pendingDeliveries = await this.prisma.delivery.count({
      where: { deliveryStatus: { in: ['Pending', 'OutForDelivery'] } },
    });

    // 5. Today's Pickup Count
    const todayPickups = await this.prisma.pickupRequest.count({
      where: {
        pickupDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    // 6. Today's Delivery Count
    const todayDeliveries = await this.prisma.delivery.count({
      where: {
        deliveryDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    // 7. Monthly Revenue
    const monthlyRevAgg = await this.prisma.order.aggregate({
      where: {
        createdDate: {
          gte: startOfMonth,
        },
      },
      _sum: { netAmount: true },
    });
    const monthlyRevenue = monthlyRevAgg._sum.netAmount || 0;

    // 8. Top Customers
    const topCustomersRaw = await this.prisma.order.groupBy({
      by: ['customerId'],
      _sum: { netAmount: true },
      _count: { id: true },
      orderBy: {
        _sum: {
          netAmount: 'desc',
        },
      },
      take: 5,
    });

    const topCustomers = await Promise.all(
      topCustomersRaw.map(async (item) => {
        const customer = await this.prisma.customer.findUnique({
          where: { id: item.customerId },
          select: { firstName: true, lastName: true, email: true, customerCode: true },
        });
        return {
          customer,
          totalSpent: item._sum.netAmount || 0,
          orderCount: item._count.id,
        };
      }),
    );

    // 9. Top Services
    const topServicesRaw = await this.prisma.orderItem.groupBy({
      by: ['serviceId'],
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    const topServices = await Promise.all(
      topServicesRaw.map(async (item) => {
        const service = await this.prisma.service.findUnique({
          where: { id: item.serviceId },
          select: { serviceName: true, serviceType: true },
        });
        return {
          service,
          totalQuantity: item._sum.quantity || 0,
        };
      }),
    );

    return {
      totalCustomers,
      totalOrders,
      totalRevenue,
      pendingDeliveries,
      todayPickups,
      todayDeliveries,
      monthlyRevenue,
      topCustomers,
      topServices,
    };
  }
}
