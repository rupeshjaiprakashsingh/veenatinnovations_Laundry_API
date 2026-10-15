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
        findMany: jest.fn().mockResolvedValue([]),
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
        { provide: NotificationSenderService, useValue: { sendOrderCreatedEmail: jest.fn(), sendPaymentReceivedEmail: jest.fn().mockResolvedValue(true) } },
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
    // Delivery charge = 30.0 (Standard service < 10 clothes)
    // Bundled Taxable Base = 77.5 + 5.0 + 30.0 = 112.50
    // GST (5%) = 112.50 * 0.05 = 5.63
    // First order discount = 0.0 (quantity <= 5)
    // Gross total = 112.50 + 5.63 = 118.13
    // Net amount = 118.13
    // Final payable = 118.13
    // Round off = 0.0
    // Total savings = 0.0

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
    expect(result.deliveryCharge).toBe(30.0);
    expect(result.taxableBase).toBe(112.50);
    expect(result.taxAmount).toBe(5.63);
    expect(result.grossTotal).toBe(118.13);
    expect(result.netAmount).toBe(118.13);
    expect(result.finalPayable).toBe(118.13);
    expect(result.roundOff).toBe(0.0);
    expect(result.totalSavings).toBe(0.0);
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
    // Delivery charge = 0.0 (standard order >= 10 clothes is FREE)
    // Bundled Taxable Base = 1000 + 5.0 + 0 = 1005.0
    // GST (5%) = 1005 * 0.05 = 50.25
    // Free delivery saving = 30.0
    // First order discount = 100.0 (subtotal > 600)
    // Gross total = 1005 + 50.25 = 1055.25
    // Net amount = 1055.25 - 100 = 955.25
    // Final payable = 955.25
    // Total savings = 30.0 (free delivery saving) + 100.0 (first order discount) = 130.0

    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 1, clothType: 'Coat', quantity: 10 },
      ],
    });

    expect(result.deliveryCharge).toBe(0.0);
    expect(result.taxableBase).toBe(1005.0);
    expect(result.taxAmount).toBe(50.25);
    expect(result.totalSavings).toBe(130.0);
    expect(result.finalPayable).toBe(955.25);
  });

  it('should apply free delivery when clothes count < 10 but order value is greater than 300', async () => {
    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });

    serviceRepositoryMock.findById.mockResolvedValue({
      id: 1,
      serviceName: 'Dry Cleaning Suit',
      price: 175.0,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 1,
      price: 175.0,
    });

    // 2 items * 175.0 = 350.0 subtotal (> 300 threshold with 2 clothes < 10)
    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 1, clothType: 'Suit', quantity: 2 },
      ],
    });

    expect(result.subtotal).toBe(350.0);
    expect(result.deliveryCharge).toBe(0.0); // Free delivery unlocked by order value > 300!
  });

  describe('OrderService.calculateDeliveryCharge', () => {
    it('should charge 30 when clothes < 10 and order value <= 300', () => {
      expect(OrderService.calculateDeliveryCharge(8, 250)).toBe(30);
      expect(OrderService.calculateDeliveryCharge(1, 150)).toBe(30);
      expect(OrderService.calculateDeliveryCharge(9, 300)).toBe(30); // exactly 300 is not > 300
    });

    it('should give free delivery when clothes < 10 and order value > 300', () => {
      expect(OrderService.calculateDeliveryCharge(8, 350)).toBe(0);
      expect(OrderService.calculateDeliveryCharge(1, 450)).toBe(0);
      expect(OrderService.calculateDeliveryCharge(9, 300.01)).toBe(0);
    });

    it('should give free delivery when clothes >= 10 regardless of order value', () => {
      expect(OrderService.calculateDeliveryCharge(12, 200)).toBe(0);
      expect(OrderService.calculateDeliveryCharge(10, 50)).toBe(0);
      expect(OrderService.calculateDeliveryCharge(15, 1000)).toBe(0);
    });

    it('should correctly evaluate dynamic rule conditions', () => {
      // Rule 1: < 10 clothes and <= 300 value -> matches (8, 250)
      expect(OrderService.evaluateRuleCondition(8, 250, '< 10', '<= 300')).toBe(true);
      expect(OrderService.evaluateRuleCondition(8, 350, '< 10', '<= 300')).toBe(false);

      // Rule 2: < 10 clothes and > 300 value -> matches (8, 350)
      expect(OrderService.evaluateRuleCondition(8, 350, '< 10', '> 300')).toBe(true);
      expect(OrderService.evaluateRuleCondition(8, 250, '< 10', '> 300')).toBe(false);

      // Rule 3: >= 10 clothes and ANY value -> matches (12, 200)
      expect(OrderService.evaluateRuleCondition(12, 200, '>= 10', 'ANY')).toBe(true);
      expect(OrderService.evaluateRuleCondition(9, 200, '>= 10', 'ANY')).toBe(false);
    });

    it('should resolve delivery charge dynamically from database rules', async () => {
      (prismaMock as any).pricingRule = {
        findMany: jest.fn().mockResolvedValue([
          { ruleType: 'DELIVERY', conditionClothes: '< 10', conditionValue: '<= 300', deliveryCharge: 30, isActive: true },
          { ruleType: 'DELIVERY', conditionClothes: '< 10', conditionValue: '> 300', deliveryCharge: 0, isActive: true },
          { ruleType: 'DELIVERY', conditionClothes: '>= 10', conditionValue: 'ANY', deliveryCharge: 0, isActive: true },
        ]),
      };

      const feeSmallLow = await orderService.getDeliveryChargeFromRules(8, 250);
      expect(feeSmallLow).toBe(30);

      const feeSmallHigh = await orderService.getDeliveryChargeFromRules(8, 350);
      expect(feeSmallHigh).toBe(0);

      const feeLarge = await orderService.getDeliveryChargeFromRules(12, 200);
      expect(feeLarge).toBe(0);
    });
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
    // Delivery charge = 30.0 (< 10 items)
    // Bundled Taxable Base = 10 + 5 + 30 = 45.0
    // GST (5%) = 45.0 * 0.05 = 2.25
    // Coupon discount = 500.0
    // Gross total = 45.0 + 2.25 = 47.25
    // Total discount = 500.0
    // Cap total discount at gross total (47.25)
    // Net amount = 0.0
    // Final payable = 0.0

    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 1, clothType: 'Shirt', quantity: 1 },
      ],
      couponCode: 'SUPERMEGA',
    });

    expect(result.taxableBase).toBe(45.0);
    expect(result.taxAmount).toBe(2.25);
    expect(result.grossTotal).toBe(47.25);
    expect(result.totalDiscount).toBe(47.25);
    expect(result.netAmount).toBe(0.0);
    expect(result.finalPayable).toBe(0.0);
  });

  it('should always apply ₹30 delivery charge for Grivana Priority with 1 item', async () => {
    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });

    serviceRepositoryMock.findById.mockResolvedValue({
      id: 10,
      serviceName: 'Grivana Priority Express',
      serviceType: 'Grivana Priority',
      price: 25.0,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 10,
      price: 25.0,
    });

    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 10, clothType: 'Shirt', quantity: 1 },
      ],
      isPriority: true,
    });

    expect(result.isPriorityOrder).toBe(true);
    expect(result.deliveryCharge).toBe(30.0);
    // Subtotal 25 + platform 5 + delivery 30 = Base 60. Tax 5% = 3.0. Gross = 63.0
    expect(result.taxableBase).toBe(60.0);
    expect(result.taxAmount).toBe(3.0);
    expect(result.finalPayable).toBe(63.0);
  });

  it('should always apply ₹30 delivery charge for Grivana Priority with 12 items (never free)', async () => {
    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });

    serviceRepositoryMock.findById.mockResolvedValue({
      id: 10,
      serviceName: 'Grivana Priority Express',
      serviceType: 'Grivana Priority',
      price: 16.0,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 10,
      price: 16.0,
    });

    // 12 items * 16 = 192.00
    // Platform fee = 5.00
    // Delivery charge = 30.00 (Priority orders ALWAYS charged delivery)
    // Bundled Taxable Base = 192.00 + 5.00 + 30.00 = 227.00
    // GST (5%) = 227.00 * 0.05 = 11.35
    // First order discount = 0.0 (mocked existing orders or non-first)
    prismaMock.order.count.mockResolvedValue(1);

    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 10, clothType: 'Shirt', quantity: 12 },
      ],
      isPriority: true,
    });

    expect(result.isPriorityOrder).toBe(true);
    expect(result.subtotal).toBe(192.00);
    expect(result.platformFee).toBe(5.0);
    expect(result.deliveryCharge).toBe(30.0);
    expect(result.taxableBase).toBe(227.0);
    expect(result.taxAmount).toBe(11.35);
    expect(result.grossTotal).toBe(238.35);
    expect(result.finalPayable).toBe(238.35);
    expect(result.totalSavings).toBe(0.0); // NO free delivery savings
  });

  it('should always apply ₹30 delivery charge for Grivana Priority with 20 items (max cap)', async () => {
    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });

    serviceRepositoryMock.findById.mockResolvedValue({
      id: 10,
      serviceName: 'Grivana Priority Express',
      serviceType: 'Grivana Priority',
      price: 20.0,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 10,
      price: 20.0,
    });

    prismaMock.order.count.mockResolvedValue(2);

    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 10, clothType: 'Shirt', quantity: 20 },
      ],
      notes: 'Priority: Grivana Priority',
    });

    expect(result.isPriorityOrder).toBe(true);
    expect(result.deliveryCharge).toBe(30.0);
    expect(result.subtotal).toBe(400.0);
    // Bundled Taxable Base = 400 + 5 + 30 = 435.0. Tax (5%) = 21.75. Gross = 456.75
    expect(result.taxableBase).toBe(435.0);
    expect(result.taxAmount).toBe(21.75);
    expect(result.finalPayable).toBe(456.75);
    expect(result.totalSavings).toBe(0.0);
  });

  it('should use configurable GST rate from process.env and apply to bundled base', async () => {
    // Configure GST rate at 18%
    process.env.GST_RATE = '18';

    customerRepositoryMock.findById.mockResolvedValue({
      id: 1,
      insuranceExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });

    serviceRepositoryMock.findById.mockResolvedValue({
      id: 1,
      serviceName: 'Standard Press Coat',
      price: 100.0,
      isActive: true,
    });
    prismaMock.service.findUnique.mockResolvedValue({
      id: 1,
      price: 100.0,
    });

    // 1 item, subtotal = 100.0
    // Platform fee = 5.0
    // Delivery charge = 30.0 (< 10 clothes and subtotal 100 <= 300)
    // Bundled Taxable Base = 100.0 + 5.0 + 30.0 = 135.0
    // GST (18%) = 135.0 * 0.18 = 24.30
    const result = await orderService.calculateOrderBillDetails({
      customerId: 1,
      branchId: 1,
      orderItems: [
        { serviceId: 1, clothType: 'Coat', quantity: 1 },
      ],
    });

    expect(result.taxableBase).toBe(135.0);
    expect(result.taxAmount).toBe(24.30);
    expect(result.grossTotal).toBe(159.30);
    expect(result.finalPayable).toBe(159.30);
  });

  describe('Option 2: Bundled GST Billing (Third Change Regression & Automation Tests)', () => {
    beforeEach(() => {
      process.env.GST_RATE = '18';
    });

    it('should match the exact prompt & user screenshot example (Base Value ₹47, GST 18% = ₹8.46, Total = ₹55.46)', () => {
      // Prompt/image example:
      // Component: Laundry + Platform + Delivery
      // Base Value = 47.0 (e.g. Laundry 42 + Platform 5 + Delivery 0)
      // GST Rate = 18%
      // GST Amount = 8.46
      // Customer Pays = 55.46
      const bundled = OrderService.calculateBundledGst(42.0, 5.0, 0.0, 18);
      expect(bundled.taxableBase).toBe(47.0);
      expect(bundled.taxAmount).toBe(8.46);
      const customerPays = bundled.taxableBase + bundled.taxAmount;
      expect(customerPays).toBe(55.46);
    });

    it('should calculate bundled GST on Laundry + Platform + Delivery when delivery is charged (₹30)', () => {
      // Subtotal 250 (8 clothes <= 300) + Platform 5 + Delivery 30
      // Base Value = 250 + 5 + 30 = 285.0
      // GST (18%) = 285 * 0.18 = 51.30
      // Customer Pays = 285 + 51.30 = 336.30
      const bundled = OrderService.calculateBundledGst(250.0, 5.0, 30.0, 18);
      expect(bundled.taxableBase).toBe(285.0);
      expect(bundled.taxAmount).toBe(51.30);
      expect(bundled.taxableBase + bundled.taxAmount).toBe(336.30);
    });

    it('should calculate bundled GST on Laundry + Platform + Delivery when delivery is free (₹0)', () => {
      // Subtotal 350 (8 clothes > 300) + Platform 5 + Delivery 0
      // Base Value = 350 + 5 + 0 = 355.0
      // GST (18%) = 355 * 0.18 = 63.90
      // Customer Pays = 355 + 63.90 = 418.90
      const bundled = OrderService.calculateBundledGst(350.0, 5.0, 0.0, 18);
      expect(bundled.taxableBase).toBe(355.0);
      expect(bundled.taxAmount).toBe(63.90);
      expect(bundled.taxableBase + bundled.taxAmount).toBe(418.90);
    });

    it('should verify end-to-end calculateOrderBillDetails applies 18% GST to bundled base with insurance', async () => {
      customerRepositoryMock.findById.mockResolvedValue({
        id: 1,
        insuranceExpiry: null, // Customer does not have active insurance
      });

      serviceRepositoryMock.findById.mockResolvedValue({
        id: 1,
        serviceName: 'Standard Ironing Kurta',
        price: 42.0,
        isActive: true,
      });
      prismaMock.service.findUnique.mockResolvedValue({
        id: 1,
        price: 42.0,
      });

      // 1 item * 42 = 42.0 subtotal. Less than 10 clothes and <= 300, but let's test delivery = 0 scenario with mock
      (prismaMock as any).pricingRule = {
        findMany: jest.fn().mockResolvedValue([
          { ruleType: 'DELIVERY', conditionClothes: '< 10', conditionValue: '<= 300', deliveryCharge: 0, isActive: true },
        ]),
      };

      const result = await orderService.calculateOrderBillDetails({
        customerId: 1,
        branchId: 1,
        orderItems: [
          { serviceId: 1, clothType: 'Kurta', quantity: 1 },
        ],
        insuranceOpted: true,
        insuranceType: 'MONTHLY', // ₹250
      });

      // Base Value = 42 + 5 (platform) + 0 (delivery) = 47.0
      // GST (18%) = 47 * 0.18 = 8.46
      // Monthly Insurance = 250.0
      // Gross Total = 47.0 + 8.46 + 250.0 = 305.46
      // Final Payable = 305.46
      expect(result.subtotal).toBe(42.0);
      expect(result.platformFee).toBe(5.0);
      expect(result.deliveryCharge).toBe(0.0);
      expect(result.taxableBase).toBe(47.0);
      expect(result.taxAmount).toBe(8.46);
      expect(result.insuranceCharge).toBe(250.0);
      expect(result.grossTotal).toBe(305.46);
      expect(result.finalPayable).toBe(305.46);
    });
  });

  describe('Payment Mode Normalization & Preservation Regression Tests', () => {
    it('should normalize Razorpay to UPI (Razorpay) when updating payment status', async () => {
      const orderMock = {
        id: 101,
        orderNumber: 'ORD-00101',
        totalAmount: 100,
        taxAmount: 5,
        discountAmount: 0,
        netAmount: 135,
        notes: 'Priority: No',
        customer: { email: 'test@example.com', firstName: 'John' },
      };

      prismaMock.order.findUnique = jest.fn().mockResolvedValue(orderMock);
      prismaMock.payment = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1, paymentMode: 'UPI (Razorpay)' }),
        update: jest.fn().mockResolvedValue({ id: 1, paymentMode: 'UPI (Razorpay)' }),
      };

      const orderRepoMock = {
        update: jest.fn().mockResolvedValue(orderMock),
      };
      (orderService as any).orderRepository = orderRepoMock;

      await orderService.updatePaymentStatus(101, {
        paymentStatus: 'Paid',
        paymentMode: 'Razorpay',
      });

      expect(prismaMock.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMode: 'UPI (Razorpay)',
            paymentStatus: 'Paid',
          }),
        }),
      );
    });

    it('should preserve existing UPI (Razorpay) payment mode instead of falling back to Cash', async () => {
      const orderMock = {
        id: 102,
        orderNumber: 'ORD-00102',
        totalAmount: 100,
        taxAmount: 5,
        discountAmount: 0,
        netAmount: 135,
        notes: 'Payment Mode: Razorpay | Txn Ref: pay_123',
        customer: { email: 'test@example.com', firstName: 'John' },
      };

      const existingPaymentMock = {
        id: 5,
        orderId: 102,
        paymentMode: 'UPI (Razorpay)',
        paymentStatus: 'Pending',
      };

      prismaMock.order.findUnique = jest.fn().mockResolvedValue(orderMock);
      prismaMock.payment = {
        findFirst: jest.fn().mockResolvedValue(existingPaymentMock),
        update: jest.fn().mockResolvedValue({ ...existingPaymentMock, paymentStatus: 'Paid' }),
        create: jest.fn(),
      };

      const orderRepoMock = {
        update: jest.fn().mockResolvedValue(orderMock),
      };
      (orderService as any).orderRepository = orderRepoMock;

      // Updating payment status without specifying paymentMode
      await orderService.updatePaymentStatus(102, {
        paymentStatus: 'Paid',
      });

      expect(prismaMock.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMode: 'UPI (Razorpay)',
            paymentStatus: 'Paid',
          }),
        }),
      );
    });

    it('should resolve UPI (Razorpay) from notes if paymentMode is omitted and no prior payment exists', async () => {
      const orderMock = {
        id: 103,
        orderNumber: 'ORD-00103',
        totalAmount: 100,
        taxAmount: 5,
        discountAmount: 0,
        netAmount: 135,
        notes: 'Payment Mode: Razorpay | Txn Ref: pay_TmWCFJXsxk4eAO',
        customer: { email: 'test@example.com', firstName: 'John' },
      };

      prismaMock.order.findUnique = jest.fn().mockResolvedValue(orderMock);
      prismaMock.payment = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 2 }),
        update: jest.fn(),
      };

      const orderRepoMock = {
        update: jest.fn().mockResolvedValue(orderMock),
      };
      (orderService as any).orderRepository = orderRepoMock;

      await orderService.updatePaymentStatus(103, {
        paymentStatus: 'Paid',
      });

      expect(prismaMock.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMode: 'UPI (Razorpay)',
            paymentStatus: 'Paid',
          }),
        }),
      );
    });

    it('should sanitize legacy Rs. 20 notes to actual discount amount in enrichOrderWithBillingDetails', () => {
      const orderWithLegacyNote = {
        id: 530,
        orderNumber: 'ORD-00530',
        totalAmount: 156.0,
        discountAmount: 100.0,
        taxAmount: 28.08,
        netAmount: 89.08,
        notes: 'Slot: 8 PM - 9 PM | Referral Qualified: 1st Order >10 clothes (Referrer gets Rs. 50) | Insurance: Not Selected | First Order Discount: Rs. 20 Applied | Payment Mode: Pay on Delivery (Cash / UPI) | Delivery: Free',
        orderItems: [
          { quantity: 4, clothType: 'Shirt', service: { serviceName: 'Ironing' } },
          { quantity: 8, clothType: 'Pant', service: { serviceName: 'Ironing' } },
        ],
      };

      const enriched = orderService.enrichOrderWithBillingDetails(orderWithLegacyNote);
      expect(enriched.notes).toContain('First Order Discount: Rs. 100 Applied');
      expect(enriched.notes).not.toContain('First Order Discount: Rs. 20 Applied');
      expect(enriched.discountAmount).toBe(100.0);
      expect(enriched.netAmount).toBe(89.08);
    });

    describe('First Order Discount Rules (Above ₹300 & Dry Cleaning & Quantity)', () => {
      it('should apply ₹50 discount for 1 dry cleaning coat (subtotal ₹400 > 300, quantity 1)', async () => {
        customerRepositoryMock.findById.mockResolvedValue({ id: 1, insuranceExpiry: null });
        serviceRepositoryMock.findById.mockResolvedValue({ id: 1, serviceName: 'Dry Clean Suit', price: 400.0, isActive: true });
        prismaMock.service.findUnique.mockResolvedValue({ id: 1, price: 400.0 });
        prismaMock.order.count.mockResolvedValue(0);

        const result = await orderService.calculateOrderBillDetails({
          customerId: 1,
          branchId: 1,
          orderItems: [{ serviceId: 1, clothType: 'Suit', quantity: 1 }],
        });

        expect(result.firstOrderDiscount).toBe(50.0);
        expect(result.deliveryCharge).toBe(0.0); // > 300 free delivery
        // Bundled Base: 400 + 5 = 405. GST 18%: 72.90. Gross: 477.90
        expect(result.subtotal).toBe(400.0);
        expect(result.taxAmount).toBe(72.90);
        expect(result.grossTotal).toBe(477.90);
        expect(result.finalPayable).toBe(427.90); // 477.90 - 50 = 427.90
        expect(result.totalSavings).toBe(80.0); // 30 (free delivery) + 50 (first order)
      });

      it('should apply ₹50 discount for 3 sarees roll press (subtotal ₹360 > 300, quantity 3 <= 5)', async () => {
        customerRepositoryMock.findById.mockResolvedValue({ id: 1, insuranceExpiry: null });
        serviceRepositoryMock.findById.mockResolvedValue({ id: 1, serviceName: 'Press / Ironing', price: 120.0, isActive: true });
        prismaMock.service.findUnique.mockResolvedValue({ id: 1, price: 120.0 });
        prismaMock.order.count.mockResolvedValue(0);

        const result = await orderService.calculateOrderBillDetails({
          customerId: 1,
          branchId: 1,
          orderItems: [{ serviceId: 1, clothType: 'Saree - Roll Press', quantity: 3 }],
        });

        expect(result.firstOrderDiscount).toBe(50.0);
        expect(result.deliveryCharge).toBe(0.0); // > 300 free delivery
        // Bundled Base: 360 + 5 = 365. GST 18%: 65.70. Gross: 430.70
        expect(result.subtotal).toBe(360.0);
        expect(result.taxAmount).toBe(65.70);
        expect(result.grossTotal).toBe(430.70);
        expect(result.finalPayable).toBe(380.70); // 430.70 - 50 = 380.70
        expect(result.totalSavings).toBe(80.0);
      });

      it('should apply ₹50 discount for dry cleaning even if subtotal <= 300 and quantity <= 5', async () => {
        customerRepositoryMock.findById.mockResolvedValue({ id: 1, insuranceExpiry: null });
        serviceRepositoryMock.findById.mockResolvedValue({ id: 1, serviceName: 'Dry Cleaning', price: 150.0, isActive: true });
        prismaMock.service.findUnique.mockResolvedValue({ id: 1, price: 150.0 });
        prismaMock.order.count.mockResolvedValue(0);

        const result = await orderService.calculateOrderBillDetails({
          customerId: 1,
          branchId: 1,
          orderItems: [{ serviceId: 1, clothType: 'Shirt (Dry Clean)', quantity: 1 }],
        });

        expect(result.firstOrderDiscount).toBe(50.0);
      });

      it('should apply ₹100 discount for first order with subtotal > 600 even if quantity <= 10', async () => {
        customerRepositoryMock.findById.mockResolvedValue({ id: 1, insuranceExpiry: null });
        serviceRepositoryMock.findById.mockResolvedValue({ id: 1, serviceName: 'Dry Cleaning', price: 350.0, isActive: true });
        prismaMock.service.findUnique.mockResolvedValue({ id: 1, price: 350.0 });
        prismaMock.order.count.mockResolvedValue(0);

        const result = await orderService.calculateOrderBillDetails({
          customerId: 1,
          branchId: 1,
          orderItems: [{ serviceId: 1, clothType: 'Heavy Lehenga', quantity: 2 }],
        });

        expect(result.subtotal).toBe(700.0);
        expect(result.firstOrderDiscount).toBe(100.0);
      });

      it('should apply ₹0 discount for standard order <= 5 clothes and subtotal <= 300 without dry cleaning', async () => {
        customerRepositoryMock.findById.mockResolvedValue({ id: 1, insuranceExpiry: null });
        serviceRepositoryMock.findById.mockResolvedValue({ id: 1, serviceName: 'Ironing', price: 20.0, isActive: true });
        prismaMock.service.findUnique.mockResolvedValue({ id: 1, price: 20.0 });
        prismaMock.order.count.mockResolvedValue(0);

        const result = await orderService.calculateOrderBillDetails({
          customerId: 1,
          branchId: 1,
          orderItems: [{ serviceId: 1, clothType: 'Shirt', quantity: 3 }],
        });

        expect(result.firstOrderDiscount).toBe(0.0);
      });

      it('should apply ₹0 discount when not first order (order count > 0)', async () => {
        customerRepositoryMock.findById.mockResolvedValue({ id: 1, insuranceExpiry: null });
        serviceRepositoryMock.findById.mockResolvedValue({ id: 1, serviceName: 'Dry Cleaning', price: 500.0, isActive: true });
        prismaMock.service.findUnique.mockResolvedValue({ id: 1, price: 500.0 });
        prismaMock.order.count.mockResolvedValue(2);

        const result = await orderService.calculateOrderBillDetails({
          customerId: 1,
          branchId: 1,
          orderItems: [{ serviceId: 1, clothType: 'Coat', quantity: 1 }],
        });

        expect(result.firstOrderDiscount).toBe(0.0);
      });
    });
  });
});
