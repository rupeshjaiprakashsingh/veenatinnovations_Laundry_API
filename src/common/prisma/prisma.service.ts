import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.syncDatabaseSequences();
  }

  async syncDatabaseSequences() {
    const tableNames = [
      'orders',
      'order_items',
      'order_status_history',
      'notifications',
      'customers',
      'branches',
      'addresses',
      'services',
      'products',
      'service_prices',
      'laundry_shops',
      'payments',
      'deliveries',
      'pickup_requests',
      'coupons',
      'time_slots',
      'referrals',
      'banners',
      'employees',
    ];

    for (const table of tableNames) {
      try {
        await this.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT max(id) FROM "${table}"), 1)) FROM "${table}";`
        );
      } catch (err: any) {
        console.warn(`[PrismaService] Sequence reset warning for table ${table}: ${err?.message}`);
      }
    }
    console.log('[PrismaService] PostgreSQL sequences synchronized successfully.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
