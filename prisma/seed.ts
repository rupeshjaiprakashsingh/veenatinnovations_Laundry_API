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
    update: {},
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
    update: {},
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
    update: {},
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
    update: {},
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
    update: {},
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

  // 6. Create services
  console.log('Cleaning existing services...');
  await prisma.service.deleteMany({});

  const servicesData = [
    {
      serviceName: 'Premium Laundry',
      serviceType: 'Washing',
      price: 179.0,
      description: '₹179 / kg | 72 Hrs',
      estimatedHours: 72,
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
      addons: undefined
    },
    {
      serviceName: 'Steam Press',
      serviceType: 'Ironing',
      price: 15.0,
      description: 'starting ₹15 / pc | 48 Hrs',
      estimatedHours: 48,
      addons: undefined
    },
    {
      serviceName: 'Premium Steam Press',
      serviceType: 'Ironing',
      price: 30.0,
      description: 'starting ₹30 / pc | 24 Hrs',
      estimatedHours: 24,
      addons: undefined
    },
    {
      serviceName: 'Starching',
      serviceType: 'Ironing',
      price: 25.0,
      description: 'starting ₹25 / pc | 48 Hrs',
      estimatedHours: 48,
      addons: undefined
    },
    {
      serviceName: 'Bag Cleaning',
      serviceType: 'Dry Cleaning',
      price: 249.0,
      description: 'starting ₹249 / pc | 72 Hrs',
      estimatedHours: 72,
      addons: undefined
    },
    {
      serviceName: 'Dry Clean',
      serviceType: 'Dry Cleaning',
      price: 109.0,
      description: 'starting ₹109 / pc | 72 Hrs',
      estimatedHours: 72,
      addons: undefined
    },
    {
      serviceName: 'Wash & Fold',
      serviceType: 'Washing',
      price: 79.0,
      description: '₹79 / kg | 96 Hrs',
      estimatedHours: 96,
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
      addons: [
        { name: 'Antiviral Cleaning', price: 5.0 },
        { name: 'Fabric Softener', price: 5.0 }
      ]
    }
  ];

  for (const s of servicesData) {
    await prisma.service.create({ data: s });
    console.log(`Service created: ${s.serviceName}`);
  }

  // 7. Create Customer
  const customer = await prisma.customer.upsert({
    where: { customerCode: 'CUST-001' },
    update: {},
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
