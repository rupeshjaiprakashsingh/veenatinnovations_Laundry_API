import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database (staff only — no dummy services)...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);
  const deliveryPassword = await bcrypt.hash('delivery123', 10);

  // 1. Create Main Branch
  const branch = await prisma.branch.upsert({
    where: { branchCode: 'BR-MAIN' },
    update: {
      branchName: 'Main Branch HQ',
      address: '123 Laundry St, Clean City',
      contactNumber: '9876543210',
      email: 'hq@laundry.com',
      isActive: true,
    },
    create: {
      branchName: 'Main Branch HQ',
      branchCode: 'BR-MAIN',
      address: '123 Laundry St, Clean City',
      contactNumber: '9876543210',
      email: 'hq@laundry.com',
      isActive: true,
    },
  });
  console.log(`Branch: ${branch.branchName}`);

  // 2. Create SuperAdmin
  await prisma.employee.upsert({
    where: { employeeCode: 'EMP-ADMIN' },
    update: {
      fullName: 'Super Admin',
      mobileNumber: '9999999999',
      email: 'admin@laundry.com',
      role: 'SuperAdmin',
      password: adminPassword,
      isActive: true,
    },
    create: {
      employeeCode: 'EMP-ADMIN',
      fullName: 'Super Admin',
      mobileNumber: '9999999999',
      email: 'admin@laundry.com',
      role: 'SuperAdmin',
      password: adminPassword,
      isActive: true,
    },
  });
  console.log('SuperAdmin ready');

  // 3. Create Branch Manager
  await prisma.employee.upsert({
    where: { employeeCode: 'EMP-MGR' },
    update: {
      fullName: 'Branch Manager',
      mobileNumber: '9888888888',
      email: 'manager@laundry.com',
      role: 'BranchManager',
      password: managerPassword,
      branchId: branch.id,
      isActive: true,
    },
    create: {
      employeeCode: 'EMP-MGR',
      fullName: 'Branch Manager',
      mobileNumber: '9888888888',
      email: 'manager@laundry.com',
      role: 'BranchManager',
      password: managerPassword,
      branchId: branch.id,
      isActive: true,
    },
  });
  console.log('Branch Manager ready');

  // 4. Create Staff
  await prisma.employee.upsert({
    where: { employeeCode: 'EMP-STAFF' },
    update: {
      fullName: 'Staff Member',
      mobileNumber: '9777777777',
      email: 'staff@laundry.com',
      role: 'Employee',
      password: staffPassword,
      branchId: branch.id,
      isActive: true,
    },
    create: {
      employeeCode: 'EMP-STAFF',
      fullName: 'Staff Member',
      mobileNumber: '9777777777',
      email: 'staff@laundry.com',
      role: 'Employee',
      password: staffPassword,
      branchId: branch.id,
      isActive: true,
    },
  });
  console.log('Staff ready');

  // 5. Create Delivery Boy
  await prisma.employee.upsert({
    where: { employeeCode: 'EMP-DELIVERY' },
    update: {
      fullName: 'Delivery Boy',
      mobileNumber: '9666666666',
      email: 'delivery@laundry.com',
      role: 'DeliveryBoy',
      password: deliveryPassword,
      branchId: branch.id,
      isActive: true,
    },
    create: {
      employeeCode: 'EMP-DELIVERY',
      fullName: 'Delivery Boy',
      mobileNumber: '9666666666',
      email: 'delivery@laundry.com',
      role: 'DeliveryBoy',
      password: deliveryPassword,
      branchId: branch.id,
      isActive: true,
    },
  });
  console.log('Delivery Boy ready');

  // 6. Deduplicate deliveries (Clean up existing duplicates)
  console.log('🧹 Deduplicating deliveries...');
  const groups = await prisma.delivery.groupBy({
    by: ['orderId'],
    _count: {
      id: true,
    },
    having: {
      orderId: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  console.log(`Found ${groups.length} order(s) with duplicate deliveries.`);

  let totalDeleted = 0;
  for (const group of groups) {
    const orderId = group.orderId;
    const deliveries = await prisma.delivery.findMany({
      where: { orderId },
      orderBy: { id: 'asc' },
    });
    const toKeep = deliveries[deliveries.length - 1];
    const toDeleteIds = deliveries
      .slice(0, -1)
      .map(d => d.id);

    const deleted = await prisma.delivery.deleteMany({
      where: {
        id: {
          in: toDeleteIds,
        },
      },
    });
    totalDeleted += deleted.count;
  }
  console.log(`Deleted ${totalDeleted} duplicate delivery records.`);

  // NOTE: Services, Products, and Prices are NOT seeded here.
  // Add them from the Admin Panel → Services & Pricing pages.
  console.log('\n✅ Seed complete. No dummy services seeded.');
  console.log('👉 Login to Admin Panel and add Services, Products & Prices manually.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
