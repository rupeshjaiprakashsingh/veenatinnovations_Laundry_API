import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto } from './coupon.dto';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCouponDto) {
    const codeUpper = dto.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findUnique({ where: { code: codeUpper } });
    if (existing) {
      throw new BadRequestException(`Coupon with code ${codeUpper} already exists`);
    }

    return this.prisma.coupon.create({
      data: {
        ...dto,
        code: codeUpper,
      },
    });
  }

  async findAll() {
    return this.prisma.coupon.findMany({
      orderBy: { createdDate: 'desc' },
    });
  }

  async findOne(id: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }
    return coupon;
  }

  async update(id: number, dto: UpdateCouponDto) {
    await this.findOne(id); // Throws if not found

    if (dto.code) {
      const codeUpper = dto.code.trim().toUpperCase();
      const existing = await this.prisma.coupon.findFirst({
        where: {
          code: codeUpper,
          NOT: { id },
        },
      });
      if (existing) {
        throw new BadRequestException(`Coupon with code ${codeUpper} already exists`);
      }
      dto.code = codeUpper;
    }

    return this.prisma.coupon.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.coupon.delete({ where: { id } });
  }

  async validateCoupon(code: string, customerId?: number) {
    const codeUpper = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({ where: { code: codeUpper } });

    if (!coupon) {
      throw new NotFoundException(`Coupon code "${codeUpper}" is invalid`);
    }

    if (!coupon.isActive) {
      throw new BadRequestException(`Coupon code "${codeUpper}" is no longer active`);
    }

    return {
      valid: true,
      code: coupon.code,
      discount: coupon.discount,
      description: coupon.description,
    };
  }
}
