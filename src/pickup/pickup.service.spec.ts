import { PickupService } from './pickup.service';

describe('PickupService - Delivery Portal Clothes & Order Resolution', () => {
  let service: PickupService;
  let pickupRepository: any;
  let employeeRepository: any;
  let customerRepository: any;
  let prisma: any;
  let notificationSender: any;

  beforeEach(() => {
    pickupRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    employeeRepository = { findById: jest.fn() };
    customerRepository = { findById: jest.fn() };
    notificationSender = {
      sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      delivery: { findMany: jest.fn().mockResolvedValue([]) },
      pickupRequest: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    service = new PickupService(
      pickupRepository,
      employeeRepository,
      customerRepository,
      prisma,
      notificationSender,
    );
  });

  it('returns full clothes details (orderItems + service + totalClothes) when pickupTime contains [ORDER:id]', async () => {
    pickupRepository.findAll.mockResolvedValue([
      {
        id: 297,
        customerId: 14,
        pickupAddress: 'D wing 701 Vaikutn Dham, Mumbai 400078',
        pickupDate: new Date('2026-11-07T00:00:00Z'),
        pickupTime: '9 AM - 10 AM [ORDER:562]',
        status: 'Assigned',
        assignedEmployeeId: 6,
        customer: { firstName: 'Sunny', lastName: 'User', mobileNumber: '9136662022' },
      },
    ]);

    prisma.order.findUnique.mockResolvedValue({
      id: 562,
      orderNumber: 'ORD-00562',
      orderStatus: 'Pickup Scheduled',
      totalAmount: 60,
      discountAmount: 0,
      taxAmount: 3.3,
      netAmount: 93.3,
      paymentStatus: 'Pending',
      laundryShopId: null,
      laundryShop: null,
      orderItems: [
        {
          id: 1001,
          serviceId: 1,
          clothType: 'Shirt',
          quantity: 3,
          unitPrice: 12,
          totalPrice: 36,
          service: { id: 1, serviceName: 'Press / Ironing' },
        },
        {
          id: 1002,
          serviceId: 1,
          clothType: 'Trouser / Pant',
          quantity: 2,
          unitPrice: 12,
          totalPrice: 24,
          service: { id: 1, serviceName: 'Press / Ironing' },
        },
      ],
    });

    const result = await service.findByEmployee(6);

    expect(result).toHaveLength(1);
    expect(result[0].pickupTime).toBe('9 AM - 10 AM');
    expect(result[0].order.id).toBe(562);
    expect(result[0].order.orderNumber).toBe('ORD-00562');
    expect(result[0].order.totalClothes).toBe(5);
    expect(result[0].order.orderItems).toHaveLength(2);
    expect(result[0].order.orderItems[0].clothType).toBe('Shirt');
    expect(result[0].order.orderItems[0].service.serviceName).toBe('Press / Ironing');
  });

  it('resolves orderItems even when pickup lacks [ORDER:id] tag and order was pre-assigned to Laundry status', async () => {
    pickupRepository.findAll.mockResolvedValue([
      {
        id: 298,
        customerId: 14,
        pickupAddress: 'D wing 701 Vaikutn Dham',
        pickupDate: new Date('2026-11-07T00:00:00Z'),
        pickupTime: '9 AM - 10 AM', // Legacy pickup without [ORDER:id]
        status: 'Assigned',
        assignedEmployeeId: 6,
        customer: { firstName: 'Sunny', lastName: 'User', mobileNumber: '9136662022' },
      },
    ]);

    // First findFirst (New Order / Pickup Scheduled) returns null because Admin already assigned Laundry Shop -> status 'Laundry'
    prisma.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 563,
        orderNumber: 'ORD-00563',
        orderStatus: 'Laundry',
        laundryShopId: 2,
        laundryShop: { id: 2, shopName: 'Ashok Laundry' },
        netAmount: 148.9,
        paymentStatus: 'Pending',
        orderItems: [
          {
            id: 1003,
            serviceId: 2,
            clothType: 'Suit 2 Pc',
            quantity: 1,
            unitPrice: 250,
            totalPrice: 250,
            service: { id: 2, serviceName: 'Dry Cleaning' },
          },
        ],
      });

    const result = await service.findByEmployee(6);

    expect(result).toHaveLength(1);
    expect(result[0].order.id).toBe(563);
    expect(result[0].order.orderStatus).toBe('Laundry');
    expect(result[0].order.totalClothes).toBe(1);
    expect(result[0].order.orderItems[0].clothType).toBe('Suit 2 Pc');
  });

  it('updates pre-assigned Laundry order cleanly when pickup is marked Completed without [ORDER:id] tag', async () => {
    pickupRepository.findById.mockResolvedValue({
      id: 298,
      customerId: 14,
      pickupTime: '9 AM - 10 AM',
      status: 'Assigned',
    });
    prisma.pickupRequest.update.mockResolvedValue({ id: 298, status: 'Completed' });
    prisma.order.findFirst.mockResolvedValue({
      id: 563,
      orderNumber: 'ORD-00563',
      orderStatus: 'Laundry',
      laundryShopId: 2,
      customer: { firstName: 'Sunny', email: null },
    });
    prisma.order.update.mockResolvedValue({
      id: 563,
      orderNumber: 'ORD-00563',
      orderStatus: 'Laundry',
      laundryShopId: 2,
      customer: { firstName: 'Sunny', email: null },
    });

    await service.updateStatus(298, { status: 'Completed' as any });

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 14,
          orderStatus: { in: ['New Order', 'Pickup Scheduled', 'Laundry'] },
        }),
      }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 563 },
        data: expect.objectContaining({ orderStatus: 'Laundry', laundryShopId: 2 }),
      }),
    );
  });
});
