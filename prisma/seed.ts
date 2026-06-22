import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);
  const deliveryPassword = await bcrypt.hash('delivery123', 10);
  const customerPassword = await bcrypt.hash('customer123', 10);

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
  console.log(`Branch created: ${branch.branchName}`);

  // 2. Create SuperAdmin
  const admin = await prisma.employee.upsert({
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
  console.log(`Admin created: ${admin.fullName}`);

  // 3. Create Branch Manager
  const manager = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-MGR' },
    update: {
      fullName: 'Branch Manager One',
      mobileNumber: '9888888888',
      email: 'manager@laundry.com',
      role: 'BranchManager',
      password: managerPassword,
      branchId: branch.id,
      isActive: true,
    },
    create: {
      employeeCode: 'EMP-MGR',
      fullName: 'Branch Manager One',
      mobileNumber: '9888888888',
      email: 'manager@laundry.com',
      role: 'BranchManager',
      password: managerPassword,
      branchId: branch.id,
      isActive: true,
    },
  });
  console.log(`Branch Manager created: ${manager.fullName}`);

  // 4. Create Employee (Staff)
  const staff = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-STAFF' },
    update: {
      fullName: 'Washing Specialist',
      mobileNumber: '9777777777',
      email: 'staff@laundry.com',
      role: 'Employee',
      password: staffPassword,
      branchId: branch.id,
      isActive: true,
    },
    create: {
      employeeCode: 'EMP-STAFF',
      fullName: 'Washing Specialist',
      mobileNumber: '9777777777',
      email: 'staff@laundry.com',
      role: 'Employee',
      password: staffPassword,
      branchId: branch.id,
      isActive: true,
    },
  });
  console.log(`Staff created: ${staff.fullName}`);

  // 5. Create Delivery Boy
  const delivery = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-DELIVERY' },
    update: {
      fullName: 'Swift Delivery Boy',
      mobileNumber: '9666666666',
      email: 'delivery@laundry.com',
      role: 'DeliveryBoy',
      password: deliveryPassword,
      branchId: branch.id,
      isActive: true,
    },
    create: {
      employeeCode: 'EMP-DELIVERY',
      fullName: 'Swift Delivery Boy',
      mobileNumber: '9666666666',
      email: 'delivery@laundry.com',
      role: 'DeliveryBoy',
      password: deliveryPassword,
      branchId: branch.id,
      isActive: true,
    },
  });
  console.log(`Delivery staff created: ${delivery.fullName}`);

  // 6. Create or update services
  console.log('Fetching existing services...');
  const existingServices = await prisma.service.findMany();

  const servicesData = [
    {
      serviceName: 'Premium Laundry',
      serviceType: 'Washing',
      price: 179.0,
      description: '₹179 / kg | 72 Hrs',
      estimatedHours: 72,
      image: 'ic_service_premium_laundry',
      addons: [
        { name: 'Antiviral Cleaning', price: 5.0 },
        { name: 'Fabric Softener', price: 5.0 }
      ]
    },
    {
      serviceName: 'Shoe Cleaning',
      serviceType: 'Dry Cleaning',
      price: 299.0,
      description: 'starting ₹299 / pr | 72 Hrs',
      estimatedHours: 72,
      image: 'ic_service_shoe_cleaning',
      addons: undefined
    },
    {
      serviceName: 'Steam Press',
      serviceType: 'Ironing',
      price: 15.0,
      description: 'starting ₹15 / pc | 48 Hrs',
      estimatedHours: 48,
      image: 'ic_service_steam_press',
      addons: undefined
    },
    {
      serviceName: 'Premium Steam Press',
      serviceType: 'Ironing',
      price: 30.0,
      description: 'starting ₹30 / pc | 24 Hrs',
      estimatedHours: 24,
      image: 'ic_service_prem_steam_press',
      addons: undefined
    },
    {
      serviceName: 'Starching',
      serviceType: 'Ironing',
      price: 25.0,
      description: 'starting ₹25 / pc | 48 Hrs',
      estimatedHours: 48,
      image: 'ic_service_starching',
      addons: undefined
    },
    {
      serviceName: 'Bag Cleaning',
      serviceType: 'Dry Cleaning',
      price: 249.0,
      description: 'starting ₹249 / pc | 72 Hrs',
      estimatedHours: 72,
      image: 'ic_service_bag_cleaning',
      addons: undefined
    },
    {
      serviceName: 'Dry Clean',
      serviceType: 'Dry Cleaning',
      price: 109.0,
      description: 'starting ₹109 / pc | 72 Hrs',
      estimatedHours: 72,
      image: 'ic_service_dry_clean',
      addons: undefined
    },
    {
      serviceName: 'Wash & Fold',
      serviceType: 'Washing',
      price: 79.0,
      description: '₹79 / kg | 96 Hrs',
      estimatedHours: 96,
      image: 'ic_service_wash_fold',
      addons: [
        { name: 'Antiviral Cleaning', price: 5.0 },
        { name: 'Fabric Softener', price: 5.0 }
      ]
    },
    {
      serviceName: 'Wash & Iron',
      serviceType: 'Washing',
      price: 119.0,
      description: '₹119 / kg | 96 Hrs',
      estimatedHours: 96,
      image: 'ic_service_wash_iron',
      addons: [
        { name: 'Antiviral Cleaning', price: 5.0 },
        { name: 'Fabric Softener', price: 5.0 }
      ]
    }
  ];

  for (const s of servicesData) {
    const existing = existingServices.find(es => es.serviceName === s.serviceName);
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: s,
      });
      console.log(`Service updated: ${s.serviceName}`);
    } else {
      await prisma.service.create({ data: s });
      console.log(`Service created: ${s.serviceName}`);
    }
  }

  // Soft-delete older services not in servicesData
  const activeNames = servicesData.map(s => s.serviceName);
  for (const es of existingServices) {
    if (!activeNames.includes(es.serviceName)) {
      await prisma.service.update({
        where: { id: es.id },
        data: { isActive: false },
      });
      console.log(`Service soft-deleted (set isActive to false): ${es.serviceName}`);
    }
  }

  // 7. Create Customer
  const customer = await prisma.customer.upsert({
    where: { customerCode: 'CUST-001' },
    update: {
      firstName: 'John',
      lastName: 'Doe',
      mobileNumber: '9555555555',
      email: 'customer@laundry.com',
      password: customerPassword,
      address: '456 Main Rd',
      city: 'Clean City',
      state: 'State of Hygiene',
      pincode: '400001',
      isActive: true,
    },
    create: {
      customerCode: 'CUST-001',
      firstName: 'John',
      lastName: 'Doe',
      mobileNumber: '9555555555',
      email: 'customer@laundry.com',
      password: customerPassword,
      address: '456 Main Rd',
      city: 'Clean City',
      state: 'State of Hygiene',
      pincode: '400001',
      isActive: true,
    },
  });
  console.log(`Customer created: ${customer.firstName} ${customer.lastName}`);

  // 8. Seed Products
  console.log('Seeding products...');
  const productsData = [
    { name: "Men's Shirt", emoji: "👕" },
    { name: "Men's Jeans/Trousers", emoji: "👖" },
    { name: "T-Shirt", emoji: "👕" },
    { name: "Saree (Silk)", emoji: "👘" },
    { name: "Suit (2-Piece)", emoji: "🧥" },
    { name: "Kurta Pyjama", emoji: "🥋" },
    { name: "Saree (Women's)", emoji: "👘" },
    { name: "Bed Sheet (Double)", emoji: "🛏️" },
    { name: "Bed Sheet (Single)", emoji: "🛏️" },
    { name: "Blanket (Single)", emoji: "🛌" },
    { name: "Blanket (Double)", emoji: "🛌" },
    { name: "Pillow Cover", emoji: "🧼" }
  ];

  const dbProducts: any[] = [];
  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { name: p.name },
      update: { emoji: p.emoji },
      create: p,
    });
    dbProducts.push(product);
  }

  // 9. Seed Service Prices for DEFAULT pincode
  console.log('Seeding service prices...');
  const dbServices = await prisma.service.findMany();
  
  const dryCleanSvc = dbServices.find(s => s.serviceName === 'Dry Clean');
  const steamPressSvc = dbServices.find(s => s.serviceName === 'Steam Press');
  const premiumLaundrySvc = dbServices.find(s => s.serviceName === 'Premium Laundry');
  const premiumSteamPressSvc = dbServices.find(s => s.serviceName === 'Premium Steam Press');

  const pricesToSeed: any[] = [];

  // Dry Cleaning
  if (dryCleanSvc) {
    const base = dryCleanSvc.price; // 109.0
    pricesToSeed.push(
      { serviceId: dryCleanSvc.id, productName: "Men's Shirt", price: base * 1.0 },
      { serviceId: dryCleanSvc.id, productName: "Men's Jeans/Trousers", price: base * 1.2 },
      { serviceId: dryCleanSvc.id, productName: "T-Shirt", price: base * 0.8 },
      { serviceId: dryCleanSvc.id, productName: "Saree (Silk)", price: base * 4.0 },
      { serviceId: dryCleanSvc.id, productName: "Suit (2-Piece)", price: base * 5.0 },
      { serviceId: dryCleanSvc.id, productName: "Kurta Pyjama", price: base * 2.0 },
    );
  }

  // Steam Press
  if (steamPressSvc) {
    const base = steamPressSvc.price; // 15.0
    pricesToSeed.push(
      { serviceId: steamPressSvc.id, productName: "Men's Shirt", price: base * 1.0 },
      { serviceId: steamPressSvc.id, productName: "Men's Jeans/Trousers", price: base * 1.25 },
      { serviceId: steamPressSvc.id, productName: "T-Shirt", price: base * 1.0 },
      { serviceId: steamPressSvc.id, productName: "Saree (Women's)", price: base * 2.5 },
      { serviceId: steamPressSvc.id, productName: "Kurta Pyjama", price: base * 1.5 },
      { serviceId: steamPressSvc.id, productName: "Bed Sheet (Double)", price: base * 3.0 },
    );
  }

  // Premium Laundry / Washing
  if (premiumLaundrySvc) {
    const base = 15.0; // matching hardcoded washingBasePrice = 15.0
    pricesToSeed.push(
      { serviceId: premiumLaundrySvc.id, productName: "Men's Shirt", price: base * 1.0 },
      { serviceId: premiumLaundrySvc.id, productName: "Men's Jeans/Trousers", price: base * 1.2 },
      { serviceId: premiumLaundrySvc.id, productName: "T-Shirt", price: base * 0.8 },
      { serviceId: premiumLaundrySvc.id, productName: "Saree (Women's)", price: base * 2.0 },
      { serviceId: premiumLaundrySvc.id, productName: "Kurta Pyjama", price: base * 1.5 },
      { serviceId: premiumLaundrySvc.id, productName: "Bed Sheet (Double)", price: base * 3.0 },
    );
  }

  // Premium Steam Press / Bed Sheets
  if (premiumSteamPressSvc) {
    const base = 30.0; // matching hardcoded bedSheetsBasePrice = 30.0
    pricesToSeed.push(
      { serviceId: premiumSteamPressSvc.id, productName: "Bed Sheet (Single)", price: base * 3.0 },
      { serviceId: premiumSteamPressSvc.id, productName: "Bed Sheet (Double)", price: base * 5.33 },
      { serviceId: premiumSteamPressSvc.id, productName: "Blanket (Single)", price: base * 4.0 },
      { serviceId: premiumSteamPressSvc.id, productName: "Blanket (Double)", price: base * 6.67 },
      { serviceId: premiumSteamPressSvc.id, productName: "Pillow Cover", price: base * 1.0 },
    );
  }

  // Upsert all "DEFAULT" prices
  for (const pts of pricesToSeed) {
    const prod = dbProducts.find(p => p.name === pts.productName);
    if (!prod) continue;
    
    await prisma.servicePrice.upsert({
      where: {
        serviceId_productId_pincode: {
          serviceId: pts.serviceId,
          productId: prod.id,
          pincode: "DEFAULT"
        }
      },
      update: { price: pts.price },
      create: {
        serviceId: pts.serviceId,
        productId: prod.id,
        pincode: "DEFAULT",
        price: pts.price,
        isActive: true
      }
    });
  }

  // Seed a sample override for pincode '400001'
  if (steamPressSvc) {
    const prod = dbProducts.find(p => p.name === "Men's Shirt");
    if (prod) {
      await prisma.servicePrice.upsert({
        where: {
          serviceId_productId_pincode: {
            serviceId: steamPressSvc.id,
            productId: prod.id,
            pincode: "400001"
          }
        },
        update: { price: 20.0 }, // Override Men's Shirt Steam Press price to 20.0 in 400001
        create: {
          serviceId: steamPressSvc.id,
          productId: prod.id,
          pincode: "400001",
          price: 20.0,
          isActive: true
        }
      });
      console.log("Pincode override seeded for 400001 (Men's Shirt Steam Press: 20.0)");
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
