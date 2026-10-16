import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLaundryShopDto, UpdateLaundryShopDto } from './dto/laundry-shop.dto';

@Injectable()
export class LaundryShopService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a collision-free unique shop code in the format SHOP-XXXX.
   */
  async generateUniqueShopCode(): Promise<string> {
    const count = await this.prisma.laundryShop.count();
    let candidate = `SHOP-${1000 + count + 1}`;
    let exists = await this.prisma.laundryShop.findUnique({ where: { shopCode: candidate } });
    if (!exists) return candidate;

    for (let attempts = 0; attempts < 50; attempts++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      candidate = `SHOP-${rand}`;
      exists = await this.prisma.laundryShop.findUnique({ where: { shopCode: candidate } });
      if (!exists) return candidate;
    }

    return `SHOP-${Date.now().toString().slice(-6)}`;
  }

  async create(dto: CreateLaundryShopDto) {
    const shopName = dto.shopName?.trim();
    if (!shopName) {
      throw new BadRequestException('Shop name is required');
    }

    let finalShopCode = dto.shopCode?.trim();
    if (!finalShopCode) {
      finalShopCode = await this.generateUniqueShopCode();
    } else {
      const existing = await this.prisma.laundryShop.findUnique({
        where: { shopCode: finalShopCode },
      });
      if (existing) {
        throw new BadRequestException(`Laundry shop with code "${finalShopCode}" already exists`);
      }
    }

    return this.prisma.laundryShop.create({
      data: {
        shopName,
        shopCode: finalShopCode,
        ownerName: dto.ownerName?.trim() || null,
        contactNumber: dto.contactNumber?.trim() || null,
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
        city: dto.city?.trim() || null,
        state: dto.state?.trim() || null,
        pincode: dto.pincode?.trim() || null,
        capacity: dto.capacity != null ? Number(dto.capacity) : null,
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

    const dataToUpdate: any = {};
    if (dto.shopName !== undefined) {
      const name = dto.shopName.trim();
      if (!name) {
        throw new BadRequestException('Shop name cannot be empty');
      }
      dataToUpdate.shopName = name;
    }

    if (dto.shopCode !== undefined) {
      const code = dto.shopCode.trim();
      if (code) {
        const existing = await this.prisma.laundryShop.findFirst({
          where: { shopCode: code, NOT: { id } },
        });
        if (existing) {
          throw new BadRequestException(`Shop code "${code}" is already in use`);
        }
        dataToUpdate.shopCode = code;
      }
    }

    if (dto.ownerName !== undefined) dataToUpdate.ownerName = dto.ownerName?.trim() || null;
    if (dto.contactNumber !== undefined) dataToUpdate.contactNumber = dto.contactNumber?.trim() || null;
    if (dto.email !== undefined) dataToUpdate.email = dto.email?.trim() || null;
    if (dto.address !== undefined) dataToUpdate.address = dto.address?.trim() || null;
    if (dto.city !== undefined) dataToUpdate.city = dto.city?.trim() || null;
    if (dto.state !== undefined) dataToUpdate.state = dto.state?.trim() || null;
    if (dto.pincode !== undefined) dataToUpdate.pincode = dto.pincode?.trim() || null;
    if (dto.capacity !== undefined) dataToUpdate.capacity = dto.capacity != null ? Number(dto.capacity) : null;
    if (dto.isActive !== undefined) dataToUpdate.isActive = dto.isActive;

    return this.prisma.laundryShop.update({
      where: { id },
      data: dataToUpdate,
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
