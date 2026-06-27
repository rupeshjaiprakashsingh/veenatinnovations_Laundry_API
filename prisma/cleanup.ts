/**
 * cleanup.ts — Deletes all dummy services, products, and service prices.
 * Run with: node node_modules\prisma\build\index.js generate && node -e "require('ts-node').register(); require('./prisma/cleanup')"
 * Or easier: npx ts-node prisma/cleanup.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🧹 Starting cleanup of dummy data...\n');

  // 1. Delete all service prices (FK depends on services + products)
  const pricesDel = await prisma.servicePrice.deleteMany({});
  console.log(`✅ Deleted ${pricesDel.count} service price(s)`);

  // 2. Delete all products
  const productsDel = await prisma.product.deleteMany({});
  console.log(`✅ Deleted ${productsDel.count} product(s)`);

  // 3. Delete all services
  const servicesDel = await prisma.service.deleteMany({});
  console.log(`✅ Deleted ${servicesDel.count} service(s)`);

  // 4. Delete dummy test customer (keeps real customers)
  const custDel = await prisma.customer.deleteMany({
    where: { email: 'customer@laundry.com' }
  });
  console.log(`✅ Deleted ${custDel.count} dummy customer(s)`);

  console.log('\n🎉 Cleanup complete!');
  console.log('👉 Now login to Admin Panel and add your real Services, Products, and Prices.\n');
}

main()
  .catch((e) => { console.error('❌ Cleanup error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
