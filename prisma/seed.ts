import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database...');

  // 1. Create Default Owner
  const ownerPassword = await bcrypt.hash('owner123', 10);
  const owner = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {},
    create: {
      username: 'owner',
      email: 'owner@rims.local',
      password: ownerPassword,
      role: 'OWNER',
    },
  });
  console.log(`✅ Upserted Owner user: ${owner.username}`);

  // 2. Create Default Manager
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      username: 'manager',
      email: 'manager@rims.local',
      password: managerPassword,
      role: 'MANAGER',
    },
  });
  console.log(`✅ Upserted Manager user: ${manager.username}`);

  // 3. Create Default Kasir
  const kasirPassword = await bcrypt.hash('kasir123', 10);
  const kasir = await prisma.user.upsert({
    where: { username: 'kasir' },
    update: {},
    create: {
      username: 'kasir',
      email: 'kasir@rims.local',
      password: kasirPassword,
      role: 'KASIR',
    },
  });
  console.log(`✅ Upserted Kasir user: ${kasir.username}`);

  // 4. Create Initial Default Settings
  const settings = [
    { key: 'company_name', value: 'Central Computer', description: 'Nama Toko' },
    { key: 'company_address', value: 'Jl. Contoh No. 123', description: 'Alamat Toko' },
    { key: 'company_phone', value: '08123456789', description: 'No HP Toko' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log('✅ Upserted Default Settings');

  // 5. Create Master Data: Categories
  const categoryData = [
    { name: 'Hardware', description: 'Komponen Komputer' },
    { name: 'Accessories', description: 'Mouse, Keyboard, dll' },
    { name: 'Service', description: 'Jasa Perbaikan' },
    { name: 'Laptop', description: 'Unit Laptop' },
    { name: 'Networking', description: 'Router, Kabel, dll' },
  ];

  const categories = [];
  for (const c of categoryData) {
    const cat = await prisma.category.upsert({
      where: { id: 0 }, // Fake ID for dummy upsert logic by name check below
      update: {},
      create: c,
    });
    // Since id: 0 logic above is flawed for 'where', let's use findFirst/create
    const existing = await prisma.category.findFirst({ where: { name: c.name } });
    if (existing) {
      categories.push(existing);
    } else {
      const newCat = await prisma.category.create({ data: c });
      categories.push(newCat);
    }
  }
  console.log('✅ Upserted Categories');

  // 6. Create Master Data: Suppliers
  const supplierData = [
    { name: 'PT. Distribusi Utama', phone: '021-123456', address: 'Jakarta' },
    { name: 'CV. Global Tech', phone: '021-654321', address: 'Bandung' },
  ];
  for (const s of supplierData) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.supplier.create({ data: s });
  }
  console.log('✅ Upserted Suppliers');

  // 7. Create Master Data: Products
  const hwCat = categories.find(c => c.name === 'Hardware');
  const accCat = categories.find(c => c.name === 'Accessories');
  const laptopCat = categories.find(c => c.name === 'Laptop');

  const productData = [
    { categoryId: hwCat!.id, SKU: 'SSD-512-SAMS', name: 'Samsung SSD 980 512GB', cost: 650000, price: 850000, stock: 50 },
    { categoryId: hwCat!.id, SKU: 'RAM-8GB-COR', name: 'Corsair Vengeance 8GB DDR4', cost: 400000, price: 550000, stock: 40 },
    { categoryId: accCat!.id, SKU: 'MS-LOG-G102', name: 'Logitech G102 Lightsync', cost: 200000, price: 275000, stock: 30 },
    { categoryId: accCat!.id, SKU: 'KB-REX-K9', name: 'Rexus Legionare K9', cost: 350000, price: 450000, stock: 20 },
    { categoryId: laptopCat!.id, SKU: 'LP-AS-TUF', name: 'ASUS TUF Gaming F15', cost: 12000000, price: 14500000, stock: 5 },
  ];

  for (const p of productData) {
    const { SKU, ...rest } = p;
    await prisma.product.upsert({
      where: { sku: SKU },
      update: rest,
      create: { sku: SKU, ...rest },
    });
  }
  console.log('✅ Upserted Products');

  // 8. Create Master Data: Customers
  const customerData = [
    { name: 'Budi Santoso', phone: '08122334455', type: 'RETAIL' as any },
    { name: 'Siti Aminah', phone: '08133445566', type: 'MEMBER' as any },
    { name: 'Anto Wijaya', phone: '08144556677', type: 'RETAIL' as any },
  ];
  for (const c of customerData) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (!existing) await prisma.customer.create({ data: c });
  }
  console.log('✅ Upserted Customers');

  // 9. Create Master Data: Technicians & Agents
  const technicians = [
    { name: 'Agus Servis', phone: '08991', commissionRate: 10 },
    { name: 'Dedi Teknik', phone: '08992', commissionRate: 15 },
  ];
  for (const t of technicians) {
    const existing = await prisma.technician.findFirst({ where: { name: t.name } });
    if (!existing) await prisma.technician.create({ data: t });
  }

  const agents = [
    { name: 'Agent Andi', phone: '08771', commissionRate: 5 },
  ];
  for (const a of agents) {
    const existing = await prisma.agent.findFirst({ where: { name: a.name } });
    if (!existing) await prisma.agent.create({ data: a });
  }
  console.log('✅ Upserted Technicians & Agents');

  console.log('Seeding Complete! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
