import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';
import { ReceivableStatus } from '@prisma/client';

export const receivablesRouter = Router();
receivablesRouter.use(authMiddleware);

// GET /api/receivables
receivablesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, customerId } = req.query;
  const whereClause: any = {};

  if (status) whereClause.status = status as ReceivableStatus;
  if (customerId) whereClause.customerId = parseInt(customerId as string, 10);

  try {
    const receivables = await prisma.receivable.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 } // Show latest payment info
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ status: 'success', data: receivables, message: 'Data piutang berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data piutang' });
  }
});

// GET /api/receivables/:id
receivablesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  try {
    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: {
        customer: true,
        payments: {
          include: { shift: { include: { user: { select: { username: true } } } } },
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    if (!receivable) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Data Piutang tidak ditemukan' });
      return;
    }

    let originalDetail = null;
    if (receivable.referenceType === 'TRANSACTION') {
      originalDetail = await prisma.transaction.findUnique({
        where: { id: receivable.referenceId },
        include: { items: { include: { product: true } } }
      });
    } else if (receivable.referenceType === 'WORK_ORDER') {
      originalDetail = await prisma.workOrder.findUnique({
        where: { id: receivable.referenceId },
        include: { serviceItems: true, sparepartItems: { include: { product: true } } }
      });
    }

    res.json({ 
      status: 'success', 
      data: { ...receivable, originalDetail }, 
      message: 'Detail piutang berhasil diambil' 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil detail piutang' });
  }
});

// POST /api/receivables/:id/pay
receivablesRouter.post(
  '/:id/pay',
  activityLogger('Receivable', 'Pembayaran Cicilan Piutang/Kasbon'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { amount, paymentMethod, referenceNumber } = req.body;
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Nominal pembayaran tidak valid' });
      return;
    }

    try {
      if (!req.user?.id) throw new Error('Unauthenticated');

      // Pastikan ada shift aktif
      const activeShift = await prisma.cashShift.findFirst({
        where: { userId: req.user.id, status: 'ACTIVE' },
      });

      if (!activeShift) {
        res.status(403).json({ status: 'error', code: 'NO_ACTIVE_SHIFT', message: 'Anda harus membuka Shift Kasir terlebih dahulu' });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const receivable = await tx.receivable.findUnique({ where: { id } });
        
        if (!receivable) throw new Error('RECEIVABLE_NOT_FOUND');
        if (receivable.status === 'PAID') throw new Error('ALREADY_PAID');
        if (paymentAmount > receivable.remaining) throw new Error('OVERPAYMENT');

        const newPaidAmount = receivable.paidAmount + paymentAmount;
        const newRemaining = receivable.remaining - paymentAmount;
        const newStatus = newRemaining <= 0.01 ? 'PAID' : 'PARTIAL'; // 0.01 for floating pt safety

        // Update saldo master hutang/piutang
        const updatedReceivable = await tx.receivable.update({
          where: { id },
          data: {
            paidAmount: newPaidAmount,
            remaining: newRemaining < 0 ? 0 : newRemaining, // clamp to 0
            status: newStatus,
          }
        });

        // Insert payment history binding ke Shift dan User
        const payment = await tx.receivablePayment.create({
          data: {
            receivableId: id,
            shiftId: activeShift.id,
            amount: paymentAmount,
            paymentMethod: paymentMethod || 'cash',
            referenceNumber: referenceNumber || null,
          }
        });

        return { receivable: updatedReceivable, payment };
      });

      res.status(201).json({ status: 'success', data: result, message: 'Pembayaran piutang berhasil diverifikasi dan masuk rekap kasir' });
    } catch (error: any) {
      if (error.message === 'RECEIVABLE_NOT_FOUND') {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Data Piutang tidak ditemukan' });
      } else if (error.message === 'ALREADY_PAID') {
        res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Hutang ini sudah berstatus LUNAS' });
      } else if (error.message === 'OVERPAYMENT') {
        res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Uang yang disetor melebihi sisa hutang' });
      } else {
        res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memproses setoran piutang' });
      }
    }
  }
);
