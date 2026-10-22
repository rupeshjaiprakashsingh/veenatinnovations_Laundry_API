import { Test, TestingModule } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import { CustomerRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';

describe('CustomerService – findAll() serviceability', () => {
  let service: CustomerService;
  let prisma: jest.Mocked<PrismaService>;
  let customerRepo: jest.Mocked<CustomerRepository>;

  const makePrisma = () => ({
    laundryShop: { findFirst: jest.fn() },
    servicePrice: { findFirst: jest.fn() },
    referral: { findUnique: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn() },
    notification: { deleteMany: jest.fn() },
    address: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    pickupRequest: { deleteMany: jest.fn() },
    delivery: { deleteMany: jest.fn() },
    payment: { deleteMany: jest.fn() },
    orderItem: { deleteMany: jest.fn() },
    orderStatusHistory: { deleteMany: jest.fn() },
    order: { findMany: jest.fn(), deleteMany: jest.fn() },
    customer: { findFirst: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  });

  const baseCustomer = {
    id: 1,
    firstName: 'Test',
    lastName: 'User',
    mobileNumber: '9999999999',
    email: 'test@test.com',
    customerCode: 'C001',
    isActive: true,
    createdDate: new Date(),
    gender: null,
    dob: null,
    address: null,
    city: null,
    state: null,
    landmark: null,
    houseDetails: null,
    profilePic: null,
    referralCode: null,
    fcmToken: null,
  };

  beforeEach(async () => {
    const prismaMock = makePrisma();
    const repoMock = { findAll: jest.fn(), findById: jest.fn(), update: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: CustomerRepository, useValue: repoMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    prisma = module.get(PrismaService);
    customerRepo = module.get(CustomerRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should mark customer serviceable when active laundry shop exists for pincode', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: '421103' }]);
    (prisma.laundryShop.findFirst as jest.Mock).mockResolvedValue({ id: 1, pincode: '421103', isActive: true });
    (prisma.servicePrice.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(true);
    expect(prisma.laundryShop.findFirst).toHaveBeenCalledWith({
      where: { pincode: '421103', isActive: true },
    });
    // Should NOT query servicePrice if shop already found
    expect(prisma.servicePrice.findFirst).not.toHaveBeenCalled();
  });

  it('should mark customer serviceable when active service price exists for pincode (no shop)', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: '400078' }]);
    (prisma.laundryShop.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.servicePrice.findFirst as jest.Mock).mockResolvedValue({ id: 5, pincode: '400078', isActive: true });

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(true);
    expect(prisma.servicePrice.findFirst).toHaveBeenCalledWith({
      where: { pincode: '400078', isActive: true, NOT: { pincode: 'DEFAULT' } },
    });
  });

  it('should mark customer NOT serviceable when only DEFAULT service price exists', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: '999999' }]);
    (prisma.laundryShop.findFirst as jest.Mock).mockResolvedValue(null);
    // DEFAULT price should be excluded by the NOT filter — Prisma returns null for this query
    (prisma.servicePrice.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(false);
  });

  it('should mark customer NOT serviceable when no shop or price configured', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: '400500' }]);
    (prisma.laundryShop.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.servicePrice.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(false);
  });

  it('should mark customer NOT serviceable when pincode is null', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: null }]);

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(false);
    expect(prisma.laundryShop.findFirst).not.toHaveBeenCalled();
    expect(prisma.servicePrice.findFirst).not.toHaveBeenCalled();
  });

  it('should mark customer NOT serviceable when pincode is empty string', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: '' }]);

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(false);
    expect(prisma.laundryShop.findFirst).not.toHaveBeenCalled();
  });

  it('should NOT use hardcoded list — pincode 400614 (formerly hardcoded) should check DB', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: '400614' }]);
    (prisma.laundryShop.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.servicePrice.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.findAll();

    // 400614 was hardcoded as serviceable before — now it must check DB and return false
    expect(result[0].isServiceable).toBe(false);
    expect(prisma.laundryShop.findFirst).toHaveBeenCalledWith({
      where: { pincode: '400614', isActive: true },
    });
  });

  it('should NOT use hardcoded list — pincode 400706 (formerly hardcoded) should check DB', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: '400706' }]);
    (prisma.laundryShop.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.servicePrice.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(false);
  });

  it('should trim whitespace from pincode before checking', async () => {
    customerRepo.findAll.mockResolvedValue([{ ...baseCustomer, pincode: '  421103  ' }]);
    (prisma.laundryShop.findFirst as jest.Mock).mockResolvedValue({ id: 1, pincode: '421103', isActive: true });

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(true);
    expect(prisma.laundryShop.findFirst).toHaveBeenCalledWith({
      where: { pincode: '421103', isActive: true },
    });
  });

  it('should handle multiple customers with mixed serviceability', async () => {
    customerRepo.findAll.mockResolvedValue([
      { ...baseCustomer, id: 1, pincode: '421103' },
      { ...baseCustomer, id: 2, pincode: '999999' },
      { ...baseCustomer, id: 3, pincode: null },
    ]);
    (prisma.laundryShop.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 1 }) // 421103 has shop
      .mockResolvedValueOnce(null)       // 999999 no shop
    ;
    (prisma.servicePrice.findFirst as jest.Mock)
      .mockResolvedValueOnce(null); // 999999 no price

    const result = await service.findAll();

    expect(result[0].isServiceable).toBe(true);   // 421103 — has shop
    expect(result[1].isServiceable).toBe(false);  // 999999 — no shop/price
    expect(result[2].isServiceable).toBe(false);  // null pincode
  });
});
