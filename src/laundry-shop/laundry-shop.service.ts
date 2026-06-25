import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLaundryShopDto, UpdateLaundryShopDto } from './dto/laundry-shop.dto';

@Injectable()
export class LaundryShopService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLaundryShopDto) {
    const existing = await this.prisma.laundryShop.findUnique({
      where: { shopCode: dto.shopCode },
    });
    if (existing) {
      throw new BadRequestException(`Laundry shop with code "${dto.shopCode}" already exists`);
    }

    return this.prisma.laundryShop.create({
      data: {
        shopName: dto.shopName,
        shopCode: dto.shopCode,
        ownerName: dto.ownerName,
        contactNumber: dto.contactNumber,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        capacity: dto.capacity,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll() {
    const shops = await this.prisma.laundryShop.findMany({
      include: {
        orders: {
          select: {
            id: true,
            orderStatus: true,
            netAmount: true,
            createdDate: true,
          },
        },
      },
      orderBy: { createdDate: 'desc' },
    });

    // Attach computed stats to each shop
    return shops.map((shop) => {
      const totalOrders = shop.orders.length;
      const activeOrders = shop.orders.filter((o) =>
        !['Delivered', 'Cancelled'].includes(o.orderStatus),
      ).length;
      const completedToday = shop.orders.filter((o) => {
        const today = new Date();
        const created = new Date(o.createdDate);
        return (
          o.orderStatus === 'Delivered' &&
          created.toDateString() === today.toDateString()
        );
      }).length;

      return { ...shop, totalOrders, activeOrders, completedToday };
    });
  }

  async findOne(id: number) {
    const shop = await this.prisma.laundryShop.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            customer: true,
            orderItems: { include: { service: true } },
            statusHistory: { orderBy: { createdDate: 'asc' } },
          },
          orderBy: { createdDate: 'desc' },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Laundry shop with ID ${id} not found`);
    }

    const totalOrders = shop.orders.length;
    const activeOrders = shop.orders.filter((o) =>
      !['Delivered', 'Cancelled'].includes(o.orderStatus),
    ).length;

    return { ...shop, totalOrders, activeOrders };
  }

  async update(id: number, dto: UpdateLaundryShopDto) {
    await this.findOne(id);

    if (dto.shopCode) {
      const existing = await this.prisma.laundryShop.findFirst({
        where: { shopCode: dto.shopCode, NOT: { id } },
      });
      if (existing) {
        throw new BadRequestException(`Shop code "${dto.shopCode}" is already in use`);
      }
    }

    return this.prisma.laundryShop.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      return await this.prisma.laundryShop.delete({ where: { id } });
    } catch {
      throw new BadRequestException(
        'Cannot delete laundry shop — it has orders assigned to it. Unassign orders first.',
      );
    }
  }

  /**
   * Suggest laundry shops by pincode match (exact first, then partial).
   */
  async suggestByPincode(pincode: string) {
    const all = await this.prisma.laundryShop.findMany({
      where: { isActive: true },
      orderBy: { shopName: 'asc' },
    });

    const exact = all.filter((s) => s.pincode === pincode);
    const partial = all.filter(
      (s) => s.pincode !== pincode && s.pincode?.startsWith(pincode.substring(0, 3)),
    );
    const rest = all.filter(
      (s) =>
        s.pincode !== pincode &&
        !s.pincode?.startsWith(pincode.substring(0, 3)),
    );

    return [...exact, ...partial, ...rest];
  }
}
