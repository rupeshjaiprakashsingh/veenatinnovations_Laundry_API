import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// How to run:
// Set your Render Database URL:
// $env:RENDER_DATABASE_URL="postgresql://user:password@dpg-xxx-a.oregon-postgres.render.com/laundry_db?sslmode=require"
// node export_render_db.mjs

const renderUrl = process.env.RENDER_DATABASE_URL || process.env.DATABASE_URL;

if (!renderUrl) {
  console.error("❌ ERROR: Please set RENDER_DATABASE_URL environment variable.");
  process.exit(1);
}

console.log(`🔌 Connecting to Database...`);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: renderUrl,
    },
  },
});

async function exportDatabase() {
  try {
    console.log("📦 Exporting data from all tables...");

    const backupData = {
      customers: await prisma.customer.findMany(),
      branches: await prisma.branch.findMany(),
      employees: await prisma.employee.findMany(),
      services: await prisma.service.findMany(),
      products: await prisma.product.findMany(),
      servicePrices: await prisma.servicePrice.findMany(),
      laundryShops: await prisma.laundryShop.findMany(),
      orders: await prisma.order.findMany(),
      addresses: await prisma.address.findMany(),
      orderItems: await prisma.orderItem.findMany(),
      payments: await prisma.payment.findMany(),
      pickupRequests: await prisma.pickupRequest.findMany(),
      deliveries: await prisma.delivery.findMany(),
      notifications: await prisma.notification.findMany(),
      orderStatusHistories: await prisma.orderStatusHistory.findMany(),
      coupons: await prisma.coupon.findMany(),
      timeSlots: await prisma.timeSlot.findMany(),
      referrals: await prisma.referral.findMany(),
      banners: await prisma.banner.findMany(),
    };

    const jsonPath = path.join(process.cwd(), 'render_backup_data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2));
    console.log(`✅ JSON Backup saved successfully to: ${jsonPath}`);

    // Generate SQL Insert script
    let sqlContent = `-- Render Database Backup Export\n-- Generated on: ${new Date().toISOString()}\n\n`;

    const formatValue = (val) => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number' || typeof val === 'boolean') return val;
      if (val instanceof Date) return `'${val.toISOString()}'`;
      if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const generateInserts = (tableName, records) => {
      if (!records || records.length === 0) return '';
      let str = `-- Table: ${tableName}\n`;
      for (const record of records) {
        const keys = Object.keys(record);
        const cols = keys.map(k => `"${k}"`).join(', ');
        const vals = keys.map(k => formatValue(record[k])).join(', ');
        str += `INSERT INTO "${tableName}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
      }
      return str + '\n';
    };

    sqlContent += generateInserts('customers', backupData.customers);
    sqlContent += generateInserts('branches', backupData.branches);
    sqlContent += generateInserts('employees', backupData.employees);
    sqlContent += generateInserts('services', backupData.services);
    sqlContent += generateInserts('products', backupData.products);
    sqlContent += generateInserts('service_prices', backupData.servicePrices);
    sqlContent += generateInserts('laundry_shops', backupData.laundryShops);
    sqlContent += generateInserts('orders', backupData.orders);
    sqlContent += generateInserts('addresses', backupData.addresses);
    sqlContent += generateInserts('order_items', backupData.orderItems);
    sqlContent += generateInserts('payments', backupData.payments);
    sqlContent += generateInserts('pickup_requests', backupData.pickupRequests);
    sqlContent += generateInserts('deliveries', backupData.deliveries);
    sqlContent += generateInserts('notifications', backupData.notifications);
    sqlContent += generateInserts('order_status_history', backupData.orderStatusHistories);
    sqlContent += generateInserts('coupons', backupData.coupons);
    sqlContent += generateInserts('time_slots', backupData.timeSlots);
    sqlContent += generateInserts('referrals', backupData.referrals);
    sqlContent += generateInserts('banners', backupData.banners);

    const sqlPath = path.join(process.cwd(), 'render_backup_data.sql');
    fs.writeFileSync(sqlPath, sqlContent);
    console.log(`✅ SQL Insert Backup script saved to: ${sqlPath}`);

  } catch (error) {
    console.error("❌ Export failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

exportDatabase();
