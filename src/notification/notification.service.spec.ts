import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationRepository, CustomerRepository } from '../common/repositories/laundry.repositories';
import { NotificationSenderService } from './notification-sender.service';

describe('NotificationService - Task 4 (Admin <-> Customer Order Communication & Read Receipts)', () => {
  let service: NotificationService;
  let notifRepoMock: any;
  let customerRepoMock: any;
  let senderMock: any;

  beforeEach(async () => {
    notifRepoMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    customerRepoMock = {
      findById: jest.fn(),
    };

    senderMock = {
      sendEmail: jest.fn().mockResolvedValue({ messageId: 'msg-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: notifRepoMock },
        { provide: CustomerRepository, useValue: customerRepoMock },
        { provide: NotificationSenderService, useValue: senderMock },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should create an order-based admin message with unread status and rich metadata', async () => {
    customerRepoMock.findById.mockResolvedValue({
      id: 10,
      firstName: 'Rupesh',
      lastName: 'Singh',
      email: 'rupesh@example.com',
    });

    notifRepoMock.create.mockImplementation((data: any) =>
      Promise.resolve({
        id: 101,
        ...data,
      }),
    );

    const created = await service.create({
      customerId: 10,
      orderId: 560,
      orderNumber: 'ORD-00560',
      title: 'Garment Verification Update',
      message: 'We received 2 Shirts instead of 2 T-Shirts on your order.',
      notificationType: 'AdminMessage',
    });

    expect(created.id).toBe(101);
    expect(created.orderId).toBe(560);
    expect(created.orderNumber).toBe('ORD-00560');
    expect(created.title).toBe('Garment Verification Update');
    expect(created.isAdminMessage).toBe(true);
    expect(created.isRead).toBe(false);
    expect(created.readAt).toBeNull();
    expect(created.message).toContain('[Order #ORD-00560]');
    expect(senderMock.sendEmail).toHaveBeenCalled();
  });

  it('should mark a notification as read when customer reads it and reflect read receipt to admin', async () => {
    const rawUnreadType = 'ADMIN_MSG|ORD:560|NUM:ORD-00560|TITLE:Order%20Update|UNREAD';
    notifRepoMock.findById.mockResolvedValue({
      id: 101,
      customerId: 10,
      message: '[Order #ORD-00560] Your clothes are being processed.',
      notificationType: rawUnreadType,
      isSent: true,
      sentDate: new Date(),
    });

    notifRepoMock.update.mockImplementation((id: number, data: any) =>
      Promise.resolve({
        id,
        customerId: 10,
        message: '[Order #ORD-00560] Your clothes are being processed.',
        notificationType: data.notificationType,
        isSent: true,
        sentDate: new Date(),
      }),
    );

    const readResult = await service.markAsRead(101, 10, 'Customer');

    expect(readResult.isRead).toBe(true);
    expect(readResult.readAt).toBeDefined();
    expect(readResult.orderId).toBe(560);
    expect(readResult.orderNumber).toBe('ORD-00560');
    expect(notifRepoMock.update).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        notificationType: expect.stringContaining('|READ|'),
      }),
    );
  });

  it('should prevent a customer from marking another customer notification as read', async () => {
    notifRepoMock.findById.mockResolvedValue({
      id: 102,
      customerId: 99,
      message: 'Other customer message',
      notificationType: 'Push',
    });

    await expect(service.markAsRead(102, 10, 'Customer')).rejects.toThrow(ForbiddenException);
  });

  it('should filter messages by orderId and orderNumber in findByOrder', async () => {
    notifRepoMock.findAll.mockResolvedValue([
      {
        id: 201,
        customerId: 10,
        message: '[Order #ORD-00560] Please confirm delivery time.',
        notificationType: 'ADMIN_MSG|ORD:560|NUM:ORD-00560|READ|2026-11-03T14:30:00.000Z',
        isSent: true,
        sentDate: new Date(),
      },
      {
        id: 202,
        customerId: 11,
        message: '[Order #ORD-00559] Different order.',
        notificationType: 'ADMIN_MSG|ORD:559|NUM:ORD-00559|UNREAD',
        isSent: true,
        sentDate: new Date(),
      },
    ]);

    const order560Msgs = await service.findByOrder(560, 'ORD-00560');
    expect(order560Msgs).toHaveLength(1);
    expect(order560Msgs[0].id).toBe(201);
    expect(order560Msgs[0].isRead).toBe(true);
  });
});
