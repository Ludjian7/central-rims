import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

// GET /api/reports/dashboard-stats
reportsRouter.get('/dashboard-stats', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Omzet & Transaksi Hari Ini (Gabungan Penjualan Langsung + Servisan Lunas)
    const [salesRetail, salesService] = await Promise.all([
      prisma.transaction.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { total: true },
        _count: { id: true }
      }),
      prisma.workOrder.aggregate({
        where: { 
          status: 'DIAMBIL',
          checkoutDate: { gte: today } 
        },
        _sum: { total: true },
        _count: { id: true }
      })
    ]);

    // 2. Servisan Aktif (Semua yang masih ada di Toko / Belum Diambil)
    const activeWOs = await prisma.workOrder.count({
      where: { status: { not: 'DIAMBIL' } }
    });

    // 3. Stok Rendah
    const products = await prisma.product.findMany({
      where: { isActive: true, minStock: { gt: 0 } },
      select: { stock: true, minStock: true }
    });
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

    // 4. Perkiraan Profit Hari Ini (Retail + Servis)
    
    // Profit Retail: (Price - Cost - Discount)
    const transactionItemsToday = await prisma.transactionItem.findMany({
      where: { transaction: { createdAt: { gte: today } } },
      select: { cost: true, price: true, qty: true, discount: true }
    });
    const profitRetail = transactionItemsToday.reduce((acc: number, item: any) => {
      return acc + ((item.price * item.qty) - item.discount - (item.cost * item.qty));
    }, 0);

    // Profit Servis: Jasa (100%) + Sparepart (Margin)
    const woToday = await prisma.workOrder.findMany({
      where: { status: 'DIAMBIL', checkoutDate: { gte: today } },
      include: {
        serviceItems: { select: { subtotal: true } },
        sparepartItems: { select: { price: true, cost: true, qty: true } }
      }
    });

    let profitService = 0;
    woToday.forEach(wo => {
      // Untung dari Jasa
      wo.serviceItems.forEach(s => { profitService += s.subtotal; });
      // Laba dari Sparepart (Harga Jual - Modal)
      wo.sparepartItems.forEach(sp => {
        profitService += ((sp.price * sp.qty) - (sp.cost * sp.qty));
      });
      // Potong diskon global WO
      profitService -= (wo.discount || 0);
    });

    // 5. TOP 5 Teknisi (30 Hari Terakhir - Berdasarkan WO Selesai/Diambil)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topTechniciansRaw = await prisma.workOrder.groupBy({
      by: ['technicianId'],
      where: { 
        status: 'DIAMBIL', 
        checkoutDate: { gte: thirtyDaysAgo } 
      },
      _count: { id: true },
      _sum: { total: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    const technicianIds = topTechniciansRaw.map(t => t.technicianId);
    const techDetails = await prisma.technician.findMany({
      where: { id: { in: technicianIds } },
      select: { id: true, name: true }
    });

    const topTechnicians = topTechniciansRaw.map(t => ({
      name: techDetails.find(td => td.id === t.technicianId)?.name || 'Unknown',
      woCount: t._count.id,
      revenue: t._sum.total || 0
    }));

    // 6. Unit "Nyangkut" (Aging > 7 Hari - Belum Diambil)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const agingWorkOrdersRaw = await prisma.workOrder.findMany({
      where: { 
        status: { not: 'DIAMBIL' },
        createdAt: { lt: sevenDaysAgo }
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 5
    });

    const agingWorkOrders = agingWorkOrdersRaw.map(wo => ({
      id: wo.id,
      woNumber: wo.woNumber,
      customerName: wo.customer.name,
      createdAt: wo.createdAt,
      status: wo.status,
      days: Math.floor((new Date().getTime() - new Date(wo.createdAt).getTime()) / (1000 * 3600 * 24))
    }));

    // 7. Aktivitas Terakhir (Gabungan Transaction & WorkOrder)
    const [recentSales, recentWOs] = await Promise.all([
      prisma.transaction.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } }
      }),
      prisma.workOrder.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } }
      })
    ]);

    const recentActivity = [
      ...recentSales.map(s => ({ 
        type: 'SALE', 
        title: `Penjualan: ${s.invoiceNumber}`, 
        subtitle: s.customer?.name || 'Retail', 
        amount: s.total, 
        time: s.createdAt 
      })),
      ...recentWOs.map(w => ({ 
        type: 'SERVICE', 
        title: `Servis Baru: ${w.woNumber}`, 
        subtitle: w.customer.name, 
        amount: w.total, 
        time: w.createdAt 
      }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

    res.json({
      status: 'success',
      data: {
        totalSales: (salesRetail._sum.total || 0) + (salesService._sum.total || 0),
        transactionCount: (salesRetail._count.id || 0) + (salesService._count.id || 0),
        activeWorkOrders: activeWOs,
        lowStockAlerts: lowStockCount,
        estimatedProfit: profitRetail + profitService,
        topTechnicians,
        agingWorkOrders,
        recentActivity
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil statistik dashboard' });
  }
});

// GET /api/reports/sales (Laporan Penjualan Omni-channel)
reportsRouter.get('/sales', async (req: AuthRequest, res: Response) => {
  const { startDate, endDate } = req.query;
  const where: any = {};
  
  if (startDate && endDate) {
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    where.createdAt = {
      gte: new Date(startDate as string),
      lte: end
    };
  }

  try {
    // 1. Retail Transactions
    const retail = await prisma.transaction.findMany({
      where,
      include: { customer: { select: { name: true } }, shift: { select: { user: { select: { username: true } } } } }
    });

    // 2. Service Work Orders (DIAMBIL)
    const serviceWhere: any = { status: 'DIAMBIL' };
    if (startDate && endDate) {
       const end = new Date(endDate as string);
       end.setHours(23, 59, 59, 999);
       serviceWhere.checkoutDate = { gte: new Date(startDate as string), lte: end };
    }
    const service = await prisma.workOrder.findMany({
      where: serviceWhere,
      include: { customer: { select: { name: true } } }
    });

    // 3. Receivable Payments
    const receivables = await prisma.receivablePayment.findMany({
      where,
      include: { shift: { select: { user: { select: { username: true } } } }, receivable: { include: { customer: { select: { name: true } } } } }
    });

    // Assemble unified list
    const unifiedSales = [
      ...retail.map(r => ({
        id: `TX-${r.id}`, type: 'RETAIL', referenceNumber: r.invoiceNumber,
        customerName: r.customer?.name || 'UMUM',
        cashier: r.shift?.user?.username || '-',
        paymentMethod: r.paymentMethod,
        total: r.total,
        status: r.status,
        date: r.createdAt
      })),
      ...service.map(s => ({
        id: `WO-${s.id}`, type: 'SERVICE', referenceNumber: s.woNumber,
        customerName: s.customer.name,
        cashier: '-', // WOs are normally checked out by someone but we don't have direct shift link here in current schema
        paymentMethod: 'MULTIPLE/DP',
        total: s.total,
        status: s.status,
        date: s.checkoutDate || s.updatedAt
      })),
      ...receivables.map(rcv => ({
        id: `RP-${rcv.id}`, type: 'PIUTANG', referenceNumber: rcv.referenceNumber || 'CICILAN',
        customerName: rcv.receivable.customer.name,
        cashier: rcv.shift?.user?.username || '-',
        paymentMethod: rcv.paymentMethod,
        total: rcv.amount,
        status: 'CICILAN',
        date: rcv.createdAt
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ status: 'success', data: unifiedSales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal merangkum laporan penjualan terpadu' });
  }
});

// GET /api/reports/commissions (Laporan Komisi)
reportsRouter.get('/commissions', async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, targetId, targetType } = req.query;
  const where: any = {};

  if (startDate && endDate) {
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    where.createdAt = {
        gte: new Date(startDate as string),
        lte: end
    };
  }

  if (targetType) where.targetType = targetType;
  if (targetId) {
    if (targetType === 'TECHNICIAN') where.technicianId = parseInt(targetId as string, 10);
    else if (targetType === 'AGENT') where.agentId = parseInt(targetId as string, 10);
  }

  try {
    const commissions = await prisma.commission.findMany({
      where,
      include: {
        technician: { select: { name: true } },
        agent: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
    const techCommissions = commissions.filter(c => c.targetType === 'TECHNICIAN').reduce((sum, c) => sum + c.amount, 0);
    const agentCommissions = commissions.filter(c => c.targetType === 'AGENT').reduce((sum, c) => sum + c.amount, 0);

    const grouped: Record<string, { id: number; name: string; type: string; totalWo: number; amount: number }> = {};

    commissions.forEach(c => {
      const isTech = c.targetType === 'TECHNICIAN';
      const personId = isTech ? c.technicianId : c.agentId;
      const personName = isTech ? (c.technician?.name || 'Unknown') : (c.agent?.name || 'Unknown');
      const key = `${c.targetType}_${personId}`;
      if (!grouped[key]) {
         grouped[key] = { id: personId as number, name: personName, type: c.targetType, totalWo: 0, amount: 0 };
      }
      grouped[key].totalWo += 1;
      grouped[key].amount += c.amount;
    });

    const leaderboard = Object.values(grouped).sort((a, b) => b.amount - a.amount);

    res.json({ 
      status: 'success', 
      data: {
        list: commissions,
        summary: {
           total: totalCommissions,
           technician: techCommissions,
           agent: agentCommissions
        },
        leaderboard
      } 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil laporan komisi' });
  }
});

// GET /api/reports/inventory-alerts
reportsRouter.get('/inventory-alerts', async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true, minStock: { gt: 0 } },
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' }
    });
    const lowStockProducts = products.filter(p => p.stock <= p.minStock);
    res.json({ status: 'success', data: lowStockProducts });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil laporan stok' });
  }
});

// GET /api/reports/profit (Net Profit)
reportsRouter.get('/profit', async (req: AuthRequest, res: Response) => {
  const { startDate, endDate } = req.query;
  const where: any = {};
  if (startDate && endDate) {
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    where.createdAt = {
      gte: new Date(startDate as string),
      lte: end
    };
  }

  try {
    // 1. Retail Gross Profit
    const retailItems = await prisma.transactionItem.findMany({
      where: { transaction: where }
    });
    const retailProfit = retailItems.reduce((acc, item) => acc + ((item.price * item.qty) - (item.discount || 0) - (item.cost * item.qty)), 0);

    // 2. Service Gross Profit
    const serviceWhere: any = { status: 'DIAMBIL' };
    if (startDate && endDate) {
       const end = new Date(endDate as string);
       end.setHours(23, 59, 59, 999);
       serviceWhere.checkoutDate = { gte: new Date(startDate as string), lte: end };
    }
    
    const serviceWOs = await prisma.workOrder.findMany({
      where: serviceWhere,
      include: { serviceItems: true, sparepartItems: true }
    });
    
    let serviceProfit = 0;
    serviceWOs.forEach(wo => {
      let partsProfit = 0;
      let svcProfit = 0;
      wo.sparepartItems.forEach(sp => { partsProfit += ((sp.price * sp.qty) - (sp.cost * sp.qty)); });
      wo.serviceItems.forEach(si => { svcProfit += si.subtotal; });
      serviceProfit += (partsProfit + svcProfit - (wo.discount || 0));
    });

    // 3. Minus Expenses
    const expenses = await prisma.expense.findMany({ where });
    const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);

    // 4. Minus Commissions
    const commissions = await prisma.commission.findMany({ where });
    const totalCommissions = commissions.reduce((acc, c) => acc + c.amount, 0);

    const netProfit = (retailProfit + serviceProfit) - totalExpenses - totalCommissions;

    res.json({
      status: 'success',
      data: {
        retailProfit,
        serviceProfit,
        grossProfit: retailProfit + serviceProfit,
        totalExpenses,
        totalCommissions,
        netProfit
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengalkulasi laporan profitabilitas' });
  }
});

// GET /api/reports/technician-kpi
reportsRouter.get('/technician-kpi', async (req: AuthRequest, res: Response) => {
  const { startDate, endDate } = req.query;
  const where: any = {};
  if (startDate && endDate) {
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    where.createdAt = {
      gte: new Date(startDate as string),
      lte: end
    };
  }

  try {
    const techs = await prisma.technician.findMany({ where: { isActive: true } });
    
    const wos = await prisma.workOrder.findMany({
      where: {
        technicianId: { in: techs.map(t => t.id) },
        ...where
      }
    });

    const kpis = techs.map(tech => {
      const techWOs = wos.filter(w => w.technicianId === tech.id);
      const completed = techWOs.filter(w => w.status === 'DIAMBIL' || w.status === 'SELESAI');
      const inProgress = techWOs.filter(w => w.status !== 'DIAMBIL' && w.status !== 'SELESAI');
      
      let totalTatDays = 0;
      let tatCount = 0;
      
      completed.forEach(w => {
         if (w.checkoutDate || w.updatedAt) {
            const endT = new Date((w.checkoutDate || w.updatedAt) as Date).getTime();
            const startT = new Date(w.createdAt).getTime();
            const days = (endT - startT) / (1000 * 3600 * 24);
            if(days >= 0) {
              totalTatDays += days;
              tatCount++;
            }
         }
      });
      
      const avgTat = tatCount > 0 ? (totalTatDays / tatCount).toFixed(1) : 0;
      
      return {
        id: tech.id,
        name: tech.name,
        totalWOs: techWOs.length,
        completed: completed.length,
        inProgress: inProgress.length,
        avgTatDays: avgTat,
        successRate: techWOs.length > 0 ? ((completed.length / techWOs.length) * 100).toFixed(1) : 0
      };
    });

    kpis.sort((a, b) => b.completed - a.completed);

    res.json({ status: 'success', data: kpis });
  } catch(error) {
    console.error(error);
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil KPI teknisi' });
  }
});

// GET /api/reports/recent-activities
reportsRouter.get('/recent-activities', async (req: AuthRequest, res: Response) => {
  const { period } = req.query; // 'today', '7days', '30days'
  
  const now = new Date();
  let startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Default 'today'
  
  if (period === '7days') {
    startDate.setDate(now.getDate() - 7);
  } else if (period === '30days') {
    startDate.setDate(now.getDate() - 30);
  }

  try {
    const [sales, wos] = await Promise.all([
      prisma.transaction.findMany({
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } }, shift: { select: { user: { select: { username: true } } } } }
      }),
      prisma.workOrder.findMany({
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } }, technician: { select: { name: true } } }
      })
    ]);

    const activities = [
      ...sales.map(s => ({
        id: `TX-${s.id}`,
        type: 'SALE',
        txId: s.invoiceNumber,
        category: 'Penjualan Ritel',
        title: (s as any).customer?.name || 'Umum',
        operator: (s as any).shift?.user?.username || 'Kasir',
        amount: s.total,
        status: s.status,
        date: s.createdAt
      })),
      ...wos.map(w => ({
        id: `WO-${w.id}`,
        type: 'SERVICE',
        txId: w.woNumber,
        category: 'Jasa Service',
        title: w.customer.name,
        operator: w.technician?.name || '-',
        amount: w.total,
        status: w.status,
        date: w.createdAt
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ status: 'success', data: activities });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil aktivitas detail toko' });
  }
});
