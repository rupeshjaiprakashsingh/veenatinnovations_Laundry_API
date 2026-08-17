import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeAllUsers() {
  console.log('\n=========================================');
  console.log('       REMOVING ALL CUSTOMER USERS       ');
  console.log('=========================================\n');

  try {
    const custCount = await prisma.customer.count();
    console.log(`Found ${custCount} customer user(s) in the database.`);

    if (custCount === 0) {
      console.log('No users to remove.');
      return;
    }

    console.log('Clearing user-related tables...');

    // 1. Delete all referrals
    const referrals = await prisma.referral.deleteMany({});
    console.log(`- Deleted ${referrals.count} referral(s)`);

    // 2. Delete all notifications
    const notifications = await prisma.notification.deleteMany({});
    console.log(`- Deleted ${notifications.count} notification(s)`);

    // 3. Delete all addresses
    const addresses = await prisma.address.deleteMany({});
    console.log(`- Deleted ${addresses.count} address(es)`);

    // 4. Delete all pickup requests
    const pickupRequests = await prisma.pickupRequest.deleteMany({});
    console.log(`- Deleted ${pickupRequests.count} pickup request(s)`);

    // 5. Delete all deliveries
    const deliveries = await prisma.delivery.deleteMany({});
    console.log(`- Deleted ${deliveries.count} delivery record(s)`);

    // 6. Delete all payments
    const payments = await prisma.payment.deleteMany({});
    console.log(`- Deleted ${payments.count} payment record(s)`);

    // 7. Delete all order items
    const orderItems = await prisma.orderItem.deleteMany({});
    console.log(`- Deleted ${orderItems.count} order item(s)`);

    // 8. Delete all order status histories
    const histories = await prisma.orderStatusHistory.deleteMany({});
    console.log(`- Deleted ${histories.count} order status history record(s)`);

    // 9. Delete all orders
    const orders = await prisma.order.deleteMany({});
    console.log(`- Deleted ${orders.count} order(s)`);

    // 10. Delete all customers
    const customers = await prisma.customer.deleteMany({});
    console.log(`\n=========================================`);
    console.log(`✅ SUCCESS: Removed ${customers.count} customer user(s)`);
    console.log(`=========================================\n`);
  } catch (error) {
    console.error('❌ Error removing users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

removeAllUsers();
