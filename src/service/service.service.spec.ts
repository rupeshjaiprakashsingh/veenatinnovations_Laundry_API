import { Test, TestingModule } from '@nestjs/testing';
import { ServiceService } from './service.service';
import { ServiceRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';

describe('ServiceService (Pricing Rule & Serviceability Unit Tests)', () => {
  let service: ServiceService;
  let prismaMock: any;
  let serviceRepoMock: any;

  beforeEach(async () => {
    prismaMock = {
      service: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      servicePrice: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      laundryShop: {
        findFirst: jest.fn(),
      },
      orderItem: {
        count: jest.fn(),
      },
    };

    serviceRepoMock = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceService,
        { provide: ServiceRepository, useValue: serviceRepoMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ServiceService>(ServiceService);
  });

  describe('createServicePrice (Add Price Rule in Admin Console)', () => {
    it('should create a new price rule when (serviceId, productId, pincode) does not exist yet', async () => {
      prismaMock.servicePrice.findFirst.mockResolvedValue(null);
      prismaMock.servicePrice.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 101, ...data }),
      );

      const dto = {
        serviceId: 2, // Dry Clean
        productId: 1, // Shirt
        pincode: ' 421103 ',
        price: 100,
        isActive: true,
      };

      const result = await service.createServicePrice(dto);

      expect(result).toBeDefined();
      expect(result.serviceId).toBe(2);
      expect(result.productId).toBe(1);
      expect(result.pincode).toBe('421103');
      expect(result.price).toBe(100);
      expect(result.isActive).toBe(true);
    });

    it('should update the existing price rule instead of throwing Unique constraint failed on (serviceId, productId, pincode)', async () => {
      // Simulate existing price rule in DB for Dry Clean (2) + Shirt (1) + 421103
      const existingRule = {
        id: 55,
        serviceId: 2,
        productId: 1,
        pincode: '421103',
        price: 80,
        isActive: false,
      };
      prismaMock.servicePrice.findFirst.mockResolvedValue(existingRule);

      // Simulate Prisma throwing Unique constraint error if create() is called directly
      prismaMock.servicePrice.create.mockRejectedValue(
        new Error(
          'Invalid `this.prisma.servicePrice.create()` invocation: Unique constraint failed on the fields: (`serviceId`,`productId`,`pincode`)',
        ),
      );

      prismaMock.servicePrice.update.mockImplementation(({ where, data }) =>
        Promise.resolve({
          ...existingRule,
          id: where.id,
          ...data,
        }),
      );

      const dto = {
        serviceId: 2,
        productId: 1,
        pincode: '421103',
        price: 100,
        isActive: true,
      };

      const result = await service.createServicePrice(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe(55);
      expect(result.price).toBe(100);
      expect(result.isActive).toBe(true);
      expect(prismaMock.servicePrice.create).not.toHaveBeenCalled();
      expect(prismaMock.servicePrice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 55 },
          data: expect.objectContaining({
            price: 100,
            pincode: '421103',
            isActive: true,
          }),
        }),
      );
    });

    it('should default empty pincode to DEFAULT and coerce string numbers safely', async () => {
      prismaMock.servicePrice.findFirst.mockResolvedValue(null);
      prismaMock.servicePrice.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 102, ...data }),
      );

      const result = await service.createServicePrice({
        serviceId: '3' as any,
        productId: '2' as any,
        pincode: '  default ',
        price: '150' as any,
        isActive: true,
      });

      expect(result.serviceId).toBe(3);
      expect(result.productId).toBe(2);
      expect(result.pincode).toBe('DEFAULT');
      expect(result.price).toBe(150);
    });
  });

  describe('updateServicePrice (Edit Price Rule in Admin Console)', () => {
    it('should update an existing price rule by id when no duplicate target exists', async () => {
      prismaMock.servicePrice.findUnique.mockResolvedValue({
        id: 55,
        serviceId: 2,
        productId: 1,
        pincode: '421103',
        price: 80,
        isActive: true,
      });
      prismaMock.servicePrice.findFirst.mockResolvedValue(null);
      prismaMock.servicePrice.update.mockImplementation(({ where, data }) =>
        Promise.resolve({
          id: where.id,
          serviceId: 2,
          productId: 1,
          pincode: '421103',
          price: 120,
          isActive: true,
          ...data,
        }),
      );

      const updated = await service.updateServicePrice(55, {
        price: 120,
        pincode: '421103',
        isActive: true,
      });

      expect(updated.id).toBe(55);
      expect(updated.price).toBe(120);
    });
  });

  describe('Regression: checkServiceability & getPricing', () => {
    it('should return serviceable: true when an active service price exists for the pincode', async () => {
      prismaMock.laundryShop.findFirst.mockResolvedValue(null);
      prismaMock.servicePrice.findFirst.mockResolvedValue({
        id: 55,
        pincode: '421103',
        isActive: true,
      });

      const res = await service.checkServiceability('421103');
      expect(res).toEqual({ serviceable: true });
    });
  });
});
