import { Test, TestingModule } from '@nestjs/testing';
import { LaundryShopService } from './laundry-shop.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('LaundryShopService (Functional & Regression Tests)', () => {
  let service: LaundryShopService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      laundryShop: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaundryShopService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<LaundryShopService>(LaundryShopService);
  });

  describe('create', () => {
    it('should create a laundry shop with ONLY shopName, auto-generating a unique shopCode', async () => {
      // Mock findUnique to return null (no shopCode collision)
      prismaMock.laundryShop.findUnique.mockResolvedValue(null);
      prismaMock.laundryShop.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 10, ...data }),
      );

      const result = await service.create({
        shopName: 'Quick Wash Hub',
      });

      expect(result).toBeDefined();
      expect(result.shopName).toBe('Quick Wash Hub');
      expect(result.shopCode).toMatch(/^SHOP-\d+$/);
      expect(result.ownerName).toBeNull();
      expect(result.contactNumber).toBeNull();
      expect(result.email).toBeNull();
      expect(result.address).toBeNull();
      expect(result.city).toBeNull();
      expect(result.state).toBeNull();
      expect(result.pincode).toBeNull();
      expect(result.capacity).toBeNull();
      expect(result.isActive).toBe(true);

      expect(prismaMock.laundryShop.create).toHaveBeenCalledWith({
        data: {
          shopName: 'Quick Wash Hub',
          shopCode: expect.stringMatching(/^SHOP-\d+$/),
          ownerName: null,
          contactNumber: null,
          email: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          capacity: null,
          isActive: true,
        },
      });
    });

    it('should handle empty strings in optional fields gracefully without failure', async () => {
      prismaMock.laundryShop.findUnique.mockResolvedValue(null);
      prismaMock.laundryShop.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 11, ...data }),
      );

      const result = await service.create({
        shopName: 'Rupesh Shop',
        shopCode: '',
        ownerName: '   ',
        contactNumber: '',
        email: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
      });

      expect(result.shopName).toBe('Rupesh Shop');
      expect(result.shopCode).toMatch(/^SHOP-\d+$/);
      expect(result.email).toBeNull();
      expect(result.ownerName).toBeNull();
      expect(result.contactNumber).toBeNull();
      expect(result.pincode).toBeNull();
    });

    it('should accept a custom shopCode when provided and unique', async () => {
      prismaMock.laundryShop.findUnique.mockResolvedValue(null);
      prismaMock.laundryShop.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 12, ...data }),
      );

      const result = await service.create({
        shopName: 'Deluxe Dry Cleaners',
        shopCode: 'DDC-2026',
        pincode: '400078',
      });

      expect(result.shopCode).toBe('DDC-2026');
      expect(result.pincode).toBe('400078');
    });

    it('should reject creation if shopName is missing or whitespace', async () => {
      await expect(
        service.create({
          shopName: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if custom shopCode is already in use', async () => {
      prismaMock.laundryShop.findUnique.mockResolvedValue({
        id: 1,
        shopCode: 'SHOP-EXISTING',
      });

      await expect(
        service.create({
          shopName: 'Duplicate Code Shop',
          shopCode: 'SHOP-EXISTING',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update laundry shop details', async () => {
      prismaMock.laundryShop.findUnique.mockResolvedValue({
        id: 5,
        shopName: 'Old Name',
        shopCode: 'SHOP-1005',
        orders: [],
      });
      prismaMock.laundryShop.update.mockResolvedValue({
        id: 5,
        shopName: 'Updated Name',
        shopCode: 'SHOP-1005',
        ownerName: 'Sunil',
      });

      const res = await service.update(5, {
        shopName: 'Updated Name',
        ownerName: 'Sunil',
      });

      expect(res.shopName).toBe('Updated Name');
      expect(res.ownerName).toBe('Sunil');
    });

    it('should reject update if shopCode is already used by another shop', async () => {
      prismaMock.laundryShop.findUnique.mockResolvedValue({
        id: 5,
        shopName: 'Old Name',
        shopCode: 'SHOP-1005',
        orders: [],
      });
      prismaMock.laundryShop.findFirst.mockResolvedValue({
        id: 6,
        shopCode: 'SHOP-TAKEN',
      });

      await expect(
        service.update(5, {
          shopCode: 'SHOP-TAKEN',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('suggestByPincode', () => {
    it('should rank exact matches first, partial matches second, and rest third', async () => {
      prismaMock.laundryShop.findMany.mockResolvedValue([
        { id: 1, shopName: 'Shop A', pincode: '400001', isActive: true },
        { id: 2, shopName: 'Shop B', pincode: '400078', isActive: true },
        { id: 3, shopName: 'Shop C', pincode: '560034', isActive: true },
        { id: 4, shopName: 'Shop D', pincode: '400075', isActive: true },
      ]);

      const suggestions = await service.suggestByPincode('400078');

      expect(suggestions[0].shopName).toBe('Shop B'); // Exact match
      expect(suggestions[1].pincode?.startsWith('400')).toBe(true); // Partial match (same 3-prefix)
      expect(suggestions.length).toBe(4);
    });
  });

  describe('findAll', () => {
    it('should compute activeOrders and completedToday stats accurately', async () => {
      const today = new Date().toISOString();
      prismaMock.laundryShop.findMany.mockResolvedValue([
        {
          id: 1,
          shopName: 'Shop 1',
          orders: [
            { id: 101, orderStatus: 'Washing', createdDate: today },
            { id: 102, orderStatus: 'Delivered', createdDate: today },
            { id: 103, orderStatus: 'Cancelled', createdDate: today },
          ],
        },
      ]);

      const results = await service.findAll();
      expect(results[0].totalOrders).toBe(3);
      expect(results[0].activeOrders).toBe(1); // Only Washing (Delivered and Cancelled excluded)
      expect(results[0].completedToday).toBe(1); // Delivered today
    });
  });
});
