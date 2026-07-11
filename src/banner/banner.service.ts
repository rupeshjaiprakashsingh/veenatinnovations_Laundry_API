import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './banner.dto';

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: dto,
    });
  }

  async findAll(activeOnly = true) {
    return this.prisma.banner.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
    });
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }
    return banner;
  }

  async update(id: number, dto: UpdateBannerDto) {
    await this.findOne(id); // Throws if not found
    return this.prisma.banner.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Throws if not found
    return this.prisma.banner.delete({
      where: { id },
    });
  }
}
