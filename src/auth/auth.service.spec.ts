import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationSenderService } from '../notification/notification-sender.service';

describe('AuthService - registerEmployee (Task 3)', () => {
  let service: AuthService;
  let prismaMock: any;
  let notificationSenderMock: any;

  beforeEach(async () => {
    prismaMock = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      employee: {
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      branch: {
        findUnique: jest.fn(),
      },
    };

    notificationSenderMock = {
      getAdminEmail: jest.fn().mockReturnValue('Info@saimorphixinnovations.com'),
      sendEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('jwt-token') } },
        { provide: NotificationSenderService, useValue: notificationSenderMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should skip existing EMP-0006 when count is 5 and generate EMP-0007 without 500 error', async () => {
    prismaMock.employee.count.mockResolvedValue(5);
    prismaMock.employee.findUnique.mockImplementation(({ where }: any) => {
      if (where.email) return Promise.resolve(null);
      if (where.mobileNumber) return Promise.resolve(null);
      if (where.employeeCode === 'EMP-0006') {
        // Simulates existing Rohit (EMP-0006) when total count is 5
        return Promise.resolve({ id: 6, employeeCode: 'EMP-0006', fullName: 'Rohit' });
      }
      return Promise.resolve(null);
    });
    prismaMock.branch.findUnique.mockResolvedValue({ id: 1, branchName: 'Main Branch HQ' });
    prismaMock.employee.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 7, ...data }),
    );

    const result = await service.registerEmployee({
      fullName: 'Vikram Rider',
      email: 'vikram@laundry.com',
      mobileNumber: '9876543210',
      password: 'password123',
      role: 'DeliveryBoy',
      branchId: 1,
    });

    expect(result.employeeCode).toBe('EMP-0007');
    expect(result.fullName).toBe('Vikram Rider');
    expect(result.role).toBe('DeliveryBoy');
    expect(prismaMock.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeCode: 'EMP-0007',
          branchId: 1,
          role: 'DeliveryBoy',
        }),
      }),
    );
  });

  it('should allow creating an employee without branchId or when branchId does not exist', async () => {
    prismaMock.employee.count.mockResolvedValue(2);
    prismaMock.employee.findUnique.mockResolvedValue(null);
    prismaMock.branch.findUnique.mockResolvedValue(null);
    prismaMock.employee.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 3, ...data }),
    );

    const result = await service.registerEmployee({
      fullName: 'Staff User',
      email: 'staff2@laundry.com',
      mobileNumber: '9123456789',
      password: 'password123',
      role: 'Employee',
      branchId: 999,
    });

    expect(result.employeeCode).toBe('EMP-0003');
    expect(prismaMock.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeCode: 'EMP-0003',
          branchId: undefined,
        }),
      }),
    );
  });

  it('should throw BadRequestException if email or mobileNumber is already registered', async () => {
    prismaMock.employee.findUnique.mockImplementation(({ where }: any) => {
      if (where.email === 'rohit@gmail.com') {
        return Promise.resolve({ id: 6, email: 'rohit@gmail.com' });
      }
      return Promise.resolve(null);
    });

    await expect(
      service.registerEmployee({
        fullName: 'Rohit Duplicate',
        email: 'rohit@gmail.com',
        mobileNumber: '9000000001',
        password: 'password123',
        role: 'Employee',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
