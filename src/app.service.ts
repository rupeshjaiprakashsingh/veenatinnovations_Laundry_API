import { Injectable } from '@nestjs/common';
import { PrismaService } from './common/prisma/prisma.service';
import * as os from 'os';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    const start = Date.now();
    let dbStatus: 'up' | 'down' = 'up';
    let dbLatency: number | undefined;
    let dbError: string | undefined;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
    } catch (err: any) {
      dbStatus = 'down';
      dbError = err.message || 'Unknown database connection error';
    }

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      status: dbStatus === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime * 100) / 100,
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
        ...(dbError && { error: dbError }),
      },
      system: {
        memory: {
          heapUsed: `${Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100} MB`,
          heapTotal: `${Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100} MB`,
          rss: `${Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100} MB`,
        },
        cpuLoad: os.loadavg(),
      },
    };
  }
}
