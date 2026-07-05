import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { OrderRepository, ServiceRepository, CustomerRepository, BranchRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationSenderService } from '../notification/notification-sender.service';
import { BadRequestException } from '@nestjs/common';

describe('OrderService Billing Calculations', () => {
  let orderService: OrderService;
  let serviceRepositoryMock: any;
  let customerRepositoryMock: any;
  let prismaMock: any;

  beforeEach(async () => {
    // Mock repositories and services
    serviceRepositoryMock = {
      findById: jest.fn(),
    };

    customerRepositoryMock = {
      findById: jest.fn(),
    };

    prismaMock = {
      order: {
        count: jest.fn().mockResolvedValue(0), // Mock 0 orders (first order discount applicable)
      },
      referral: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      coupon: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, pincode: 'DEFAULT' }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      servicePrice: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      service: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, price: 15.50 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: {} },
        { provide: ServiceRepository, useValue: serviceRepositoryMock },
        { provide: CustomerRepository, useValue: customerRepositoryMock },
        { provide: BranchRepository, useValue: {} },
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationSenderService, useValue: { sendOrderCreatedEmail: jest.fn() } },
      ],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
  });

  it('should calculate bill correctly with GST, platform fee, and delivery charges', async () => {
    // Set environment variable for GST rate (configurable)
    process.env.GST_RATE = '5';

    // Mock customer with active insurance
    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // active
    });

    // Mock service pricing
    serviceRepositoryMock.findById.mockResolvedValue({
      id: 1,
      serviceName: 'Steam Press Shirt',
      price: 15.50,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 1,
      price: 15.50,
    });

    // 5 items, subtotal = 15.5 * 5 = 77.5
    // Platform fee = 5.0
    // GST (5%) = 77.5 * 0.05 = 3.88
    // Delivery charge = 20.0 (items < 10)
    // First order discount = 20.0 (count = 0)
    // Gross total = 77.5 + 5.0 + 3.88 + 20.0 = 106.38
    // Net amount = 106.38 - 20 = 86.38
    // Final payable = Math.round(86.38) = 86
    // Round off = 86 - 86.38 = -0.38
    // Total savings = 20.0 (first order discount)

    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 1, clothType: 'Shirt', quantity: 5 },
      ],
      insuranceOpted: false,
    });

    expect(result.subtotal).toBe(77.5);
    expect(result.platformFee).toBe(5.0);
    expect(result.taxAmount).toBe(3.88);
    expect(result.deliveryCharge).toBe(20.0);
    expect(result.grossTotal).toBe(106.38);
    expect(result.netAmount).toBe(86.38);
    expect(result.finalPayable).toBe(86);
    expect(result.roundOff).toBe(-0.38);
    expect(result.totalSavings).toBe(20.0);
  });

  it('should apply free delivery when items count is 10 or more', async () => {
    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });

    serviceRepositoryMock.findById.mockResolvedValue({
      id: 1,
      serviceName: 'Dry Clean Coat',
      price: 100.0,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 1,
      price: 100.0,
    });

    // 10 items, subtotal = 100 * 10 = 1000
    // Platform fee = 5.0
    // GST (5%) = 1000 * 0.05 = 50.0
    // Delivery charge = 0.0 (items >= 10)
    // First order discount = 20.0
    // Gross total = 1000 + 5.0 + 50.0 + 0 = 1055.0
    // Net amount = 1055.0 - 20 = 1035.0
    // Final payable = 1035
    // Total savings = 20 (free delivery saving) + 20 (first order) = 40.0

    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 1, clothType: 'Coat', quantity: 10 },
      ],
    });

    expect(result.deliveryCharge).toBe(0.0);
    expect(result.totalSavings).toBe(40.0);
    expect(result.finalPayable).toBe(1035);
  });

  it('should ensure final payable is never negative even if discounts exceed gross total', async () => {
    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: null,
    });

    serviceRepositoryMock.findById.mockResolvedValue({
      id: 1,
      serviceName: 'Steam Press Shirt',
      price: 10.0,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 1,
      price: 10.0,
    });

    // Mock a huge coupon discount (e.g. ₹500 discount)
    prismaMock.coupon.findUnique.mockResolvedValue({
      code: 'SUPERMEGA',
      discount: 500.0,
      isActive: true,
    });

    // 1 item, subtotal = 10.0
    // Platform fee = 5.0
    // GST (5%) = 0.50
    // Delivery charge = 20.0
    // First order discount = 20.0
    // Coupon discount = 500.0
    // Gross total = 10 + 5 + 0.50 + 20 = 35.50
    // Total discount = 20 (first order) + 500 (coupon) = 520.0
    // Cap total discount at gross total (35.50)
    // Net amount = 0.0
    // Final payable = 0

    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 1, clothType: 'Shirt', quantity: 1 },
      ],
      couponCode: 'SUPERMEGA',
    });

    expect(result.totalDiscount).toBe(35.50);
    expect(result.netAmount).toBe(0.0);
    expect(result.finalPayable).toBe(0);
  });

  it('should use configurable GST rate from process.env', async () => {
    // Configure GST rate at 18%
    process.env.GST_RATE = '18';

    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });

    serviceRepositoryMock.findById.mockResolvedValue({
      id: 1,
      serviceName: 'Dry Clean Coat',
      price: 100.0,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 1,
      price: 100.0,
    });

    // 1 item, subtotal = 100.0
    // GST (18%) = 100 * 0.18 = 18.0
    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 1, clothType: 'Coat', quantity: 1 },
      ],
    });

    expect(result.taxAmount).toBe(18.0);
  });
});
