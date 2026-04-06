import { PrismaClient } from '@prisma/client';
import { subDays, startOfDay, endOfDay, addHours, addMinutes, format } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Demo Data Generation (Last 30 Days)...');

  // Fetch Master Data
  const users = await prisma.user.findMany();
  const kasir = users.find(u => u.role === 'KASIR') || users[0];
  const products = await prisma.product.findMany();
  const customers = await prisma.customer.findMany();
  const technicians = await prisma.technician.findMany();
  const expenseCategories = await prisma.expenseCategory.findMany();

  if (products.length === 0 || customers.length === 0) {
    console.error('❌ Error: Master data (products/customers) missing. Run seed first.');
    return;
  }

  // Clear relevant old operational data to avoid conflicts if re-running
  // Optional: await prisma.transactionItem.deleteMany(); etc.

  for (let i = 29; i >= 0; i--) {
    const targetDate = subDays(new Date(), i);
    const dayName = format(targetDate, 'EEEE');
    console.log(`📅 Generating data for ${format(targetDate, 'yyyy-MM-dd')} (${dayName})...`);

    // 1. Create Shift (9:00 - 21:00)
    const shiftStart = addHours(startOfDay(targetDate), 9);
    const shiftEnd = addHours(startOfDay(targetDate), 21);

    const shift = await prisma.cashShift.create({
      data: {
        userId: kasir.id,
        startTime: shiftStart,
        endTime: shiftEnd,
        openingCash: 500000,
        closingCash: 0, // Will update at end of day logic or just leave
        systemCash: 0,
        status: 'CLOSED',
        createdAt: shiftStart,
        updatedAt: shiftEnd
      }
    });

    // 2. Generate Transactions (8 - 15 per day)
    const txCount = Math.floor(Math.random() * 8) + 8;
    let dailyRevenue = 0;

    for (let j = 1; j <= txCount; j++) {
      const txTime = addMinutes(shiftStart, Math.floor(Math.random() * 700) + 10);
      const customer = customers[Math.floor(Math.random() * customers.length)];
      
      // Random items (1-3)
      const itemCount = Math.floor(Math.random() * 3) + 1;
      const selectedProducts = [];
      let subtotal = 0;

      for (let k = 0; k < itemCount; k++) {
        const prod = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const itemSubtotal = prod.price * qty;
        subtotal += itemSubtotal;
        selectedProducts.push({
          productId: prod.id,
          qty,
          cost: prod.cost,
          price: prod.price,
          subtotal: itemSubtotal
        });
      }

      const tx = await prisma.transaction.create({
        data: {
          invoiceNumber: `INV/${format(targetDate, 'yyyyMMdd')}/${j.toString().padStart(4, '0')}`,
          shiftId: shift.id,
          customerId: customer.id,
          subtotal: subtotal,
          total: subtotal,
          paidAmount: subtotal,
          paymentMethod: Math.random() > 0.3 ? 'cash' : 'transfer',
          status: 'LUNAS',
          createdAt: txTime,
          items: {
            create: selectedProducts
          }
        }
      });

      // Record Stock Movements
      for (const item of selectedProducts) {
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            qty: item.qty,
            referenceType: 'TRANSACTION',
            referenceId: tx.id,
            createdAt: txTime
          }
        });
      }

      dailyRevenue += subtotal;
    }

    // 3. Generate Work Orders (1 - 3 per day)
    const woCount = Math.floor(Math.random() * 3) + 1;
    for (let l = 1; l <= woCount; l++) {
      const woTime = addMinutes(shiftStart, Math.floor(Math.random() * 600) + 30);
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const tech = technicians[Math.floor(Math.random() * technicians.length)];
      
      const isCompleted = Math.random() > 0.3;
      const servicePrice = 150000 + (Math.floor(Math.random() * 10) * 50000);

      await prisma.workOrder.create({
        data: {
          woNumber: `WO/${format(targetDate, 'yyyyMMdd')}/${l.toString().padStart(4, '0')}`,
          customerId: customer.id,
          deviceType: 'Laptop',
          deviceBrand: 'Asus/Acer/HP',
          complaints: 'Kena Virus / Lambat',
          technicianId: tech.id,
          shiftId: shift.id,
          status: isCompleted ? 'DIAMBIL' : 'DIKERJAKAN',
          subtotal: servicePrice,
          total: servicePrice,
          paidAmount: isCompleted ? servicePrice : 0,
          paymentMethod: isCompleted ? 'cash' : null,
          checkoutDate: isCompleted ? addHours(woTime, 4) : null,
          createdAt: woTime,
          serviceItems: {
            create: [
              { name: 'Jasa Instalasi / Tune Up', price: servicePrice, qty: 1, subtotal: servicePrice }
            ]
          }
        }
      });
    }

    // 4. Generate Expenses (1 - 2 per day)
    const expCount = Math.floor(Math.random() * 2) + 1;
    for (let m = 0; m < expCount; m++) {
        const expTime = addHours(shiftStart, 2 + m);
        const amount = 20000 + (Math.floor(Math.random() * 10) * 10000);
        
        await prisma.expense.create({
            data: {
                shiftId: shift.id,
                categoryId: 1, // Default or pick random if mapped properly
                amount: amount,
                description: 'Biaya Operasional Harian',
                paymentMethod: 'cash',
                createdAt: expTime
            }
        });
    }

    // Update Shift Closing Info
    await prisma.cashShift.update({
      where: { id: shift.id },
      data: {
        systemCash: 500000 + dailyRevenue,
        closingCash: 500000 + dailyRevenue
      }
    });
  }

  console.log('✅ Demo Data Generation Complete! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
