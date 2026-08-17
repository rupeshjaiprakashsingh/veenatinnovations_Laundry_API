import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  CreateProductDto,
  UpdateProductDto,
  CreateServicePriceDto,
  UpdateServicePriceDto,
} from './service.dto';

@Injectable()
export class ServiceService {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    return this.serviceRepository.create(createServiceDto);
  }

  async findAll(adminView = false) {
    return this.prisma.service.findMany({
      where: adminView ? {} : { isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  async findAllAdmin() {
    return this.prisma.service.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number) {
    const service = await this.serviceRepository.findById(id);
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
    return service;
  }

  async update(id: number, updateServiceDto: UpdateServiceDto) {
    await this.findOne(id); // Throws if not found
    return this.serviceRepository.update(id, updateServiceDto);
  }

  async remove(id: number) {
    await this.findOne(id); // throws NotFoundException if not found

    // Check if any order_items reference this service
    const linkedOrders = await this.prisma.orderItem.count({ where: { serviceId: id } });

    if (linkedOrders > 0) {
      // Soft-delete: deactivate so it won't appear in the app/pricing
      await this.prisma.service.update({ where: { id }, data: { isActive: false } });
      return { message: `Service deactivated (${linkedOrders} order(s) reference it — cannot hard-delete)` };
    }

    // No linked orders — safe to permanently delete
    return this.serviceRepository.delete(id);
  }

  // Dynamic Pricing Method
  async getPricing(pincode?: string) {
    const targetPincode = pincode && pincode.trim().length > 0 ? pincode.trim() : 'DEFAULT';

    const services = await this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    const prices = await this.prisma.servicePrice.findMany({
      where: {
        isActive: true,
        pincode: { in: [targetPincode, 'DEFAULT'] }
      }
    });

    const getCategoryPriority = (serviceType: string, serviceName: string) => {
      const typeStr = ((serviceType || '') + ' ' + (serviceName || '')).toLowerCase();
      if (typeStr.includes('iron') || typeStr.includes('press') || typeStr.includes('steam')) return 1;
      if (typeStr.includes('wash') || typeStr.includes('laundry')) return 2;
      if (typeStr.includes('dry')) return 3;
      return 4;
    };

    return services
      .sort((a, b) => getCategoryPriority(a.serviceType, a.serviceName) - getCategoryPriority(b.serviceType, b.serviceName))
      .map(service => {
        const serviceProducts = products.map(product => {
          let matchedPrice = prices.find(p => p.serviceId === service.id && p.productId === product.id && p.pincode === targetPincode);


          return {
            id: product.id,
            name: product.name,
            emoji: product.emoji,
            price: matchedPrice ? matchedPrice.price : null,
            category: service.serviceName
          };
        }).filter(p => p.price !== null);

        return {
          id: service.id,
          serviceName: service.serviceName,
          serviceType: service.serviceType,
          basePrice: service.price,
          description: service.description,
          estimatedHours: service.estimatedHours,
          image: service.image,
          addons: service.addons,
          linkedServiceIds: service.linkedServiceIds,
          products: serviceProducts
        };
      })
      // Only return services that actually have products with prices configured
      .filter(s => s.products.length > 0);
  }


  // --- ADMIN PRODUCT CRUD ---
  async findAllProducts() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: dto
    });
  }

  async updateProduct(id: number, dto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: dto
    });
  }

  async removeProduct(id: number) {
    return this.prisma.product.delete({
      where: { id }
    });
  }

  // --- ADMIN SERVICE PRICE CRUD ---
  async findAllServicePrices() {
    return this.prisma.servicePrice.findMany({
      include: {
        service: true,
        product: true
      },
      orderBy: [
        { pincode: 'asc' },
        { serviceId: 'asc' }
      ]
    });
  }

  async createServicePrice(dto: CreateServicePriceDto) {
    return this.prisma.servicePrice.create({
      data: dto
    });
  }

  async updateServicePrice(id: number, dto: UpdateServicePriceDto) {
    return this.prisma.servicePrice.update({
      where: { id },
      data: dto
    });
  }

  async removeServicePrice(id: number) {
    return this.prisma.servicePrice.delete({
      where: { id }
    });
  }

  async checkServiceability(pincode: string): Promise<{ serviceable: boolean }> {
    const cleanPincode = pincode ? pincode.trim() : '';
    if (!cleanPincode) return { serviceable: false };

    const knownServiceablePincodes = ['400614', '400078', '400001', '400706', '400705', '400703'];
    if (knownServiceablePincodes.includes(cleanPincode)) {
      return { serviceable: true };
    }

    // 1. Check active laundry shops in this pincode
    const activeShop = await this.prisma.laundryShop.findFirst({
      where: { pincode: cleanPincode, isActive: true },
    });
    if (activeShop) return { serviceable: true };

    // 2. Check active service prices for this pincode
    const activePrice = await this.prisma.servicePrice.findFirst({
      where: { pincode: cleanPincode, isActive: true },
    });
    if (activePrice) return { serviceable: true };

    return { serviceable: false };
  }
}

