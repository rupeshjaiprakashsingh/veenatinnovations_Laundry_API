import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdDate: 'desc' },
    });
    
    console.log('\n=========================================');
    console.log('       REGISTERED CUSTOMERS LIST         ');
    console.log('=========================================');
    
    if (customers.length === 0) {
      console.log('No customers registered yet in the database.');
    } else {
      customers.forEach((c) => {
        console.log(`- Code:    ${c.customerCode}`);
        console.log(`  Name:    ${c.firstName} ${c.lastName}`);
        console.log(`  Mobile:  ${c.mobileNumber}`);
        console.log(`  Email:   ${c.email}`);
        console.log(`  Created: ${c.createdDate}`);
        console.log('-----------------------------------------');
      });
    }
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
