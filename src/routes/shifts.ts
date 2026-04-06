import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const shiftsRouter = Router();
shiftsRouter.use(authMiddleware);

// GET /api/shifts (Daftar Riwayat Shift - Owner/Manager Only)
shiftsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'MANAGER') {
      res.status(403).json({ status: 'error', code: 'FORBIDDEN', message: 'Akses terbatas untuk Owner/Manager' });
      return;
    }

    const { startDate, endDate } = req.query;

    const shifts = await prisma.cashShift.findMany({
      where: {
        ...(startDate && endDate ? {
          createdAt: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          }
        } : {})
      },
      include: {
        user: { select: { id: true, username: true } },
        closedBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ status: 'success', data: shifts, message: 'Data riwayat shift berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil riwayat shift' });
  }
});

// GET /api/shifts/active
// Mengecek apakah user yang sedang login punya shift aktif
shiftsRouter.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) throw new Error('Unauthenticated');

    const activeShift = await prisma.cashShift.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' },
    });

    if (!activeShift) {
      res.json({ status: 'success', data: null, message: 'Tidak ada shift aktif' });
      return;
    }

    // Hitung kalkulasi kas realtime (Tunai Sah Saja)
    const expenses = await prisma.expense.aggregate({
      where: { shiftId: activeShift.id, paymentMethod: 'cash' },
      _sum: { amount: true },
    });
    const cashSales = await prisma.transaction.aggregate({
      where: { 
        shiftId: activeShift.id, 
        paymentMethod: 'cash',
        status: { not: 'VOID' }
      },
      _sum: { paidAmount: true },
    });
    const receivablePayments = await prisma.receivablePayment.aggregate({
      where: { shiftId: activeShift.id, paymentMethod: 'cash' },
      _sum: { amount: true },
    });
    const workOrderPayments = await prisma.workOrder.aggregate({
      where: { 
        shiftId: activeShift.id, 
        paymentMethod: 'cash',
        status: 'DIAMBIL' // Hanya hitung yang sudah lunas/diambil
      },
      _sum: { paidAmount: true },
    });

    const totalCashIn = (cashSales._sum.paidAmount || 0) + (receivablePayments._sum.amount || 0) + (workOrderPayments._sum.paidAmount || 0);
    const totalCashOut = expenses._sum.amount || 0;
    const currentSystemCash = activeShift.openingCash + totalCashIn - totalCashOut;

    // Tambahan: Metrik Transfer (Bukan Kas Laci)
    const transferExpenses = await prisma.expense.aggregate({
      where: { shiftId: activeShift.id, paymentMethod: 'transfer' },
      _sum: { amount: true },
    });
    const transferSales = await prisma.transaction.aggregate({
      where: { 
        shiftId: activeShift.id, 
        paymentMethod: 'transfer',
        status: { not: 'VOID' }
      },
      _sum: { paidAmount: true },
    });
    const transferReceivables = await prisma.receivablePayment.aggregate({
      where: { shiftId: activeShift.id, paymentMethod: 'transfer' },
      _sum: { amount: true },
    });
    const transferWorkOrders = await prisma.workOrder.aggregate({
      where: { 
        shiftId: activeShift.id, 
        paymentMethod: 'transfer',
        status: 'DIAMBIL' 
      },
      _sum: { paidAmount: true },
    });

    const totalTransferIn = (transferSales._sum.paidAmount || 0) + (transferReceivables._sum.amount || 0) + (transferWorkOrders._sum.paidAmount || 0);
    const totalTransferOut = transferExpenses._sum.amount || 0;

    res.json({ 
      status: 'success', 
      data: {
        ...activeShift,
        calculatedSystemCash: currentSystemCash,
        metrics: {
          totalCashIn,
          totalCashOut,
          totalTransferIn,
          totalTransferOut
        }
      }, 
      message: 'Data shift aktif' 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengecek shift' });
  }
});

// POST /api/shifts/open
shiftsRouter.post(
  '/open',
  activityLogger('CashShift', 'Buka Shift Kasir'),
  async (req: AuthRequest, res: Response) => {
    const { openingCash } = req.body;

    try {
      if (!req.user?.id) throw new Error('Unauthenticated');

      // Pastikan tdk ada shift aktif
      const activeShift = await prisma.cashShift.findFirst({
        where: { userId: req.user.id, status: 'ACTIVE' },
      });

      if (activeShift) {
        res.status(400).json({ status: 'error', code: 'SHIFT_EXISTS', message: 'Anda masih memiliki shift aktif' });
        return;
      }

      const shift = await prisma.cashShift.create({
        data: {
          userId: req.user.id,
          openingCash: parseFloat(openingCash || '0'),
          status: 'ACTIVE',
        },
      });

      res.status(201).json({ status: 'success', data: shift, message: 'Shift berhasil dibuka' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal membuka shift' });
    }
  }
);

// POST /api/shifts/close
shiftsRouter.post(
  '/close',
  activityLogger('CashShift', 'Tutup Shift Kasir & Rekonsiliasi'),
  async (req: AuthRequest, res: Response) => {
    const { closingCash, shiftId } = req.body; // Boleh spesifik shiftId buat Force Close (untuk Owner/Manager)

    try {
      if (!req.user?.id) throw new Error('Unauthenticated');

      let activeShift;
      const isPrivileged = req.user.role === 'OWNER' || req.user.role === 'MANAGER';

      if (shiftId && isPrivileged) {
        // Mode Force Close oleh Atasan
        activeShift = await prisma.cashShift.findUnique({
          where: { id: parseInt(shiftId, 10), status: 'ACTIVE' },
        });
      } else {
        // Mode Tutup Shift Mandiri
        activeShift = await prisma.cashShift.findFirst({
          where: { userId: req.user.id, status: 'ACTIVE' },
        });
      }

      if (!activeShift) {
        res.status(400).json({ status: 'error', code: 'NO_SHIFT', message: 'Tidak ada shift aktif yang ditemukan' });
        return;
      }

      // Re-kalkulasi Kas Realtime yg sama seperti di GET /active
      const expenses = await prisma.expense.aggregate({
        where: { shiftId: activeShift.id, paymentMethod: 'cash' },
        _sum: { amount: true },
      });
      const cashSales = await prisma.transaction.aggregate({
        where: { 
          shiftId: activeShift.id, 
          paymentMethod: 'cash',
          status: { not: 'VOID' }
        },
        _sum: { paidAmount: true },
      });
      const receivablePayments = await prisma.receivablePayment.aggregate({
        where: { shiftId: activeShift.id, paymentMethod: 'cash' },
        _sum: { amount: true },
      });
      const workOrderPayments = await prisma.workOrder.aggregate({
        where: { 
          shiftId: activeShift.id, 
          paymentMethod: 'cash',
          status: 'DIAMBIL' 
        },
        _sum: { paidAmount: true },
      });

      const totalCashIn = (cashSales._sum.paidAmount || 0) + (receivablePayments._sum.amount || 0) + (workOrderPayments._sum.paidAmount || 0);
      const totalCashOut = expenses._sum.amount || 0;
      const systemCash = activeShift.openingCash + totalCashIn - totalCashOut;

      // ATOMIC UPDATE: Pastikan status masih ACTIVE saat di-update (Cegah Race Condition)
      const shift = await prisma.cashShift.update({
        where: { id: activeShift.id, status: 'ACTIVE' }, 
        data: {
          endTime: new Date(),
          closingCash: parseFloat(closingCash || '0'),
          systemCash,
          status: 'CLOSED',
          closedByUserId: req.user.id // Catat siapa yang tutup (Bisa kasir sendiri atau atasan)
        },
      });

      res.json({ status: 'success', data: shift, message: 'Shift berhasil ditutup' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menutup shift' });
    }
  }
);
