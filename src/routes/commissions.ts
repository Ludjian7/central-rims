import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest, roleGuard } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';
import { CommissionStatus } from '@prisma/client';

export const commissionsRouter = Router();
commissionsRouter.use(authMiddleware);

// GET /api/commissions
commissionsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { targetType, technicianId, agentId } = req.query;
  const whereClause: any = {};

  if (targetType) whereClause.targetType = targetType as string; // 'TECHNICIAN' | 'AGENT'
  if (technicianId) whereClause.technicianId = parseInt(technicianId as string, 10);
  if (agentId) whereClause.agentId = parseInt(agentId as string, 10);

  try {
    const commissions = await prisma.commission.findMany({
      where: whereClause,
      include: {
        technician: { select: { name: true } },
        agent: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ status: 'success', data: commissions, message: 'Data riwayat komisi individual berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil mutasi komisi' });
  }
});

// GET /api/commissions/recaps
commissionsRouter.get('/recaps', async (req: AuthRequest, res: Response) => {
  const { status, period } = req.query;
  // period format 'YYYY-MM'
  const whereClause: any = {};
  if (status) whereClause.status = status as CommissionStatus;
  if (period) whereClause.period = period as string;

  try {
    const recaps = await prisma.commissionRecap.findMany({
      where: whereClause,
      include: {
        technician: { select: { name: true } },
        agent: { select: { name: true } },
      },
      orderBy: { period: 'desc' }
    });
    res.json({ status: 'success', data: recaps, message: 'Data rekap komisi berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil rekap komisi' });
  }
});

// POST /api/commissions/recaps/generate
// This should ideally run via CRON but can be triggered manually by Manager
commissionsRouter.post(
  '/recaps/generate',
  roleGuard(['OWNER', 'MANAGER']),
  activityLogger('CommissionRecap', 'Generate Rekapitulasi Komisi Bulanan'),
  async (req: AuthRequest, res: Response) => {
    const { period, targetType, targetId } = req.body;
    // period format: YYYY-MM
    if (!period || !targetType || !targetId) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Parameter period, targetType, dan targetId wajib ada' });
      return;
    }

    try {
      // Find all commissions for this target in the period that haven't been recapped
      // In this simple DB structure we just match string logic or date filters since we don't have hard period mapping on row yet.
      // Easiest is to search raw dates matching the period.
      const startDate = new Date(`${period}-01T00:00:00Z`);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

      const filter: any = {
        targetType,
        recapId: null, // ONLY non-recapped ones
        createdAt: { gte: startDate, lte: endDate },
      };

      if (targetType === 'TECHNICIAN') filter.technicianId = parseInt(targetId, 10);
      else if (targetType === 'AGENT') filter.agentId = parseInt(targetId, 10);
      else throw new Error('INVALID_TARGET_TYPE');

      const unrecappedCommissions = await prisma.commission.findMany({ where: filter });
      
      if (unrecappedCommissions.length === 0) {
        res.status(400).json({ status: 'error', code: 'NO_DATA', message: 'Tidak ada komisi gantung yang dapat direkap untuk periode ini' });
        return;
      }

      const totalAmount = unrecappedCommissions.reduce((acc, curr) => acc + curr.amount, 0);

      const result = await prisma.$transaction(async (tx) => {
        // Create the recap header
        const recap = await tx.commissionRecap.create({
          data: {
            targetType,
            technicianId: targetType === 'TECHNICIAN' ? parseInt(targetId, 10) : null,
            agentId: targetType === 'AGENT' ? parseInt(targetId, 10) : null,
            period,
            totalAmount,
            status: 'PENDING',
          }
        });

        // Update all related commissions to link to this recap
        await tx.commission.updateMany({
          where: { id: { in: unrecappedCommissions.map(c => c.id) } },
          data: { recapId: recap.id }
        });

        return recap;
      });

      res.status(201).json({ status: 'success', data: result, message: 'Draf Rekap komisi berhasil diterbitkan' });
    } catch (error: any) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: error?.message || 'Gagal generate rekap' });
    }
  }
);
