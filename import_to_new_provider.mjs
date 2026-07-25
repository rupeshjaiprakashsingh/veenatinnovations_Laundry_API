import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// How to run:
// Set your New Provider's Database URL:
// $env:NEW_DATABASE_URL="postgresql://user:password@new-db-host.com:5432/laundry_db?sslmode=require"
// node import_to_new_provider.mjs

const targetUrl = process.env.NEW_DATABASE_URL || process.env.DATABASE_URL;

if (!targetUrl) {
  console.error("❌ ERROR: Please set NEW_DATABASE_URL environment variable.");
  process.exit(1);
}

const jsonPath = path.join(process.cwd(), 'render_backup_data.json');
if (!fs.existsSync(jsonPath)) {
  console.error(`❌ Backup file not found at ${jsonPath}. Run export_render_db.mjs first!`);
  process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetUrl,
    },
  },
});

async function importDatabase() {
  try {
    console.log("🔌 Connecting to target database...");

    console.log("📥 Pushing database structure with Prisma...");
    // Import tables in sequence (respecting foreign key dependencies)
    
    if (backupData.customers?.length) {
      console.log(`Importing ${backupData.customers.length} customers...`);
      for (const item of backupData.customers) {
        await prisma.customer.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.branches?.length) {
      console.log(`Importing ${backupData.branches.length} branches...`);
      for (const item of backupData.branches) {
        await prisma.branch.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.employees?.length) {
      console.log(`Importing ${backupData.employees.length} employees...`);
      for (const item of backupData.employees) {
        await prisma.employee.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.services?.length) {
      console.log(`Importing ${backupData.services.length} services...`);
      for (const item of backupData.services) {
        await prisma.service.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.products?.length) {
      console.log(`Importing ${backupData.products.length} products...`);
      for (const item of backupData.products) {
        await prisma.product.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.servicePrices?.length) {
      console.log(`Importing ${backupData.servicePrices.length} service prices...`);
      for (const item of backupData.servicePrices) {
        await prisma.servicePrice.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.laundryShops?.length) {
      console.log(`Importing ${backupData.laundryShops.length} laundry shops...`);
      for (const item of backupData.laundryShops) {
        await prisma.laundryShop.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.orders?.length) {
      console.log(`Importing ${backupData.orders.length} orders...`);
      for (const item of backupData.orders) {
        await prisma.order.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.addresses?.length) {
      console.log(`Importing ${backupData.addresses.length} addresses...`);
      for (const item of backupData.addresses) {
        await prisma.address.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.orderItems?.length) {
      console.log(`Importing ${backupData.orderItems.length} order items...`);
      for (const item of backupData.orderItems) {
        await prisma.orderItem.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.payments?.length) {
      console.log(`Importing ${backupData.payments.length} payments...`);
      for (const item of backupData.payments) {
        await prisma.payment.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.pickupRequests?.length) {
      console.log(`Importing ${backupData.pickupRequests.length} pickup requests...`);
      for (const item of backupData.pickupRequests) {
        await prisma.pickupRequest.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.deliveries?.length) {
      console.log(`Importing ${backupData.deliveries.length} deliveries...`);
      for (const item of backupData.deliveries) {
        await prisma.delivery.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.notifications?.length) {
      console.log(`Importing ${backupData.notifications.length} notifications...`);
      for (const item of backupData.notifications) {
        await prisma.notification.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.orderStatusHistories?.length) {
      console.log(`Importing ${backupData.orderStatusHistories.length} order status histories...`);
      for (const item of backupData.orderStatusHistories) {
        await prisma.orderStatusHistory.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.coupons?.length) {
      console.log(`Importing ${backupData.coupons.length} coupons...`);
      for (const item of backupData.coupons) {
        await prisma.coupon.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.timeSlots?.length) {
      console.log(`Importing ${backupData.timeSlots.length} time slots...`);
      for (const item of backupData.timeSlots) {
        await prisma.timeSlot.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.referrals?.length) {
      console.log(`Importing ${backupData.referrals.length} referrals...`);
      for (const item of backupData.referrals) {
        await prisma.referral.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    if (backupData.banners?.length) {
      console.log(`Importing ${backupData.banners.length} banners...`);
      for (const item of backupData.banners) {
        await prisma.banner.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
    }

    console.log("🎉 Database restore completed successfully!");
  } catch (error) {
    console.error("❌ Import failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

importDatabase();
