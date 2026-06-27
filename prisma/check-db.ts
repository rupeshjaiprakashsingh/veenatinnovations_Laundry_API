import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Services ---');
  const services = await prisma.service.findMany();
  console.dir(services, { depth: null });

  console.log('--- Products ---');
  const products = await prisma.product.findMany();
  console.dir(products, { depth: null });

  console.log('--- Prices ---');
  const prices = await prisma.servicePrice.findMany({
    include: {
      service: true,
      product: true,
    },
  });
  console.dir(prices, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
