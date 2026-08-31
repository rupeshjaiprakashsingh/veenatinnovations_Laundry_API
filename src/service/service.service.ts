import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
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
export class ServiceService implements OnModuleInit {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      // 1. Seed Core Services
      const defaultServices = [
        {
          serviceName: 'Steam Press',
          serviceType: 'Press / Ironing',
          price: 15.0,
          description: 'Professional wrinkle-free steam pressing & ironing.',
          estimatedHours: 24,
          isActive: true,
        },
        {
          serviceName: 'Dry Cleaning',
          serviceType: 'Dry Cleaning',
          price: 100.0,
          description: 'Eco-friendly premium dry cleaning for delicate garments.',
          estimatedHours: 48,
          isActive: true,
        },
        {
          serviceName: 'Grivana Priority',
          serviceType: 'Grivana Priority',
          price: 30.0,
          description: 'Express Priority Service with morning pickup before 11 AM, ₹30 delivery fee, and daily cap of 25 orders.',
          estimatedHours: 12,
          isActive: true,
        },
        {
          serviceName: 'Standard Washing',
          serviceType: 'Washing',
          price: 40.0,
          description: 'Hygienic wash and fold for everyday laundry.',
          estimatedHours: 24,
          isActive: true,
        },
      ];

      for (const s of defaultServices) {
        const existing = await this.prisma.service.findFirst({
          where: {
            OR: [
              { serviceName: { contains: s.serviceName, mode: 'insensitive' } },
              { serviceType: { contains: s.serviceType, mode: 'insensitive' } },
            ],
          },
        });
        if (!existing) {
          await this.prisma.service.create({ data: s });
          console.log(`[ServiceService] Seeded default service: ${s.serviceName}`);
        } else if (!existing.isActive) {
          await this.prisma.service.update({ where: { id: existing.id }, data: { isActive: true } });
        }
      }

      // 2. Seed Standard Products if none exist
      const defaultProducts = [
        { name: 'Shirt', emoji: '👔' },
        { name: 'Pant', emoji: '👖' },
        { name: 'T-Shirt', emoji: '👕' },
        { name: 'Saree', emoji: '🥻' },
        { name: 'Suit / Blazer', emoji: '🧥' },
        { name: 'Kurta', emoji: '👘' },
        { name: 'Bedsheet', emoji: '🛏️' },
        { name: 'Curtain', emoji: '🪟' },
      ];

      for (const p of defaultProducts) {
        const existingProd = await this.prisma.product.findFirst({
          where: { name: { equals: p.name, mode: 'insensitive' } }
        });
        if (!existingProd) {
          await this.prisma.product.create({ data: { name: p.name, emoji: p.emoji, isActive: true } });
          console.log(`[ServiceService] Seeded default product: ${p.name}`);
        }
      }
    } catch (err: any) {
      console.warn('[ServiceService] Error initializing services/products:', err?.message);
    }
  }

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

  // Dynamic Pricing Method — returns services/products with prices
  // configured for the EXACT pincode in the Admin Panel Pricing table,
  // falling back to DEFAULT prices or service basePrice.
  async getPricing(pincode?: string) {
    const targetPincode = pincode && pincode.trim().length > 0 ? pincode.trim().toUpperCase() : 'DEFAULT';

    const services = await this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    // Fetch prices for the target pincode AND DEFAULT
    const prices = await this.prisma.servicePrice.findMany({
      where: {
        isActive: true,
        OR: [
          { pincode: targetPincode },
          { pincode: 'DEFAULT' },
        ],
      },
    });

    const hasPincodePrices = targetPincode !== 'DEFAULT' && prices.some(p => p.pincode === targetPincode);
    const hasDefaultPrices = prices.some(p => p.pincode === 'DEFAULT');

    const getCategoryPriority = (serviceType: string, serviceName: string) => {
      const typeStr = ((serviceType || '') + ' ' + (serviceName || '')).toLowerCase();
      if (typeStr.includes('priority')) return 0;
      if (typeStr.includes('iron') || typeStr.includes('press') || typeStr.includes('steam')) return 1;
      if (typeStr.includes('dry')) return 2;
      if (typeStr.includes('wash') || typeStr.includes('laundry')) return 3;
      return 4;
    };

    return services
      .sort((a, b) => getCategoryPriority(a.serviceType, a.serviceName) - getCategoryPriority(b.serviceType, b.serviceName))
      .map(service => {
        const serviceProducts = products.map(product => {
          let matchedPrice: any = null;
          if (hasPincodePrices) {
            // Strict match for this pincode only
            matchedPrice = prices.find(p => p.serviceId === service.id && p.productId === product.id && p.pincode === targetPincode);
          } else if (hasDefaultPrices) {
            // Fallback to DEFAULT prices only if this pincode has no specific pricing configured
            matchedPrice = prices.find(p => p.serviceId === service.id && p.productId === product.id && p.pincode === 'DEFAULT');
          }

          if (!matchedPrice) {
            return null; // Product is not priced/available for this pincode
          }

          return {
            id: product.id,
            name: product.name,
            emoji: product.emoji,
            price: matchedPrice.price,
            category: service.serviceName
          };
        }).filter(p => p !== null);

        return {
          id: service.id,
          serviceName: service.serviceName,
          serviceType: service.serviceType,
          basePrice: service.price > 0 ? service.price : (serviceProducts[0] ? (serviceProducts[0] as any).price : 15.0),
          description: service.description,
          estimatedHours: service.estimatedHours,
          image: service.image,
          addons: service.addons,
          linkedServiceIds: service.linkedServiceIds,
          products: serviceProducts
        };
      })
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

  // Check serviceability ONLY from Admin Panel database —
  // returns true only if there are active laundry shops OR active service prices
  // configured for this exact pincode in the Admin Panel.
  async checkServiceability(pincode: string): Promise<{ serviceable: boolean }> {
    const cleanPincode = pincode ? pincode.trim() : '';
    if (!cleanPincode) return { serviceable: false };

    // 1. Check active laundry shops in this pincode (Admin Panel → Laundry Shops)
    const activeShop = await this.prisma.laundryShop.findFirst({
      where: { pincode: cleanPincode, isActive: true },
    });
    if (activeShop) return { serviceable: true };

    // 2. Check active service prices for this pincode (Admin Panel → Services → Pricing)
    const activePrice = await this.prisma.servicePrice.findFirst({
      where: { pincode: cleanPincode, isActive: true },
    });
    if (activePrice) return { serviceable: true };

    return { serviceable: false };
  }
}

