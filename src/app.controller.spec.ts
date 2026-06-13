import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prismaMock: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([1]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const health = await appController.getHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('database');
      expect(health.database.status).toBe('up');
    });

    it('should return error status if database is down', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('Connection lost'));
      const health = await appController.getHealth();
      expect(health.status).toBe('error');
      expect(health.database.status).toBe('down');
      expect(health.database.error).toBe('Connection lost');
    });
  });
});
