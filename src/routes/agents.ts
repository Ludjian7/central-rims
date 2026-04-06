import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const agentsRouter = Router();
agentsRouter.use(authMiddleware);

// GET /api/agents
agentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { isActive } = req.query;
  const whereClause: any = {};
  
  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  } else {
    whereClause.isActive = true;
  }

  try {
    const agents = await prisma.agent.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    res.json({ status: 'success', data: agents, message: 'Data agen berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data agen' });
  }
});

// POST /api/agents
agentsRouter.post(
  '/',
  activityLogger('Agent', 'Tambah Agen'),
  async (req: AuthRequest, res: Response) => {
    const { name, phone, commissionRate, commissionType } = req.body;

    if (!name) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Nama agen wajib diisi' });
      return;
    }

    try {
      const agent = await prisma.agent.create({
        data: { 
          name, 
          phone, 
          commissionRate: parseFloat(commissionRate || '0'),
          commissionType: commissionType || 'PERCENTAGE',
          isActive: true 
        },
      });
      res.status(201).json({ status: 'success', data: agent, message: 'Agen berhasil ditambahkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menambah agen' });
    }
  }
);

// PUT /api/agents/:id
agentsRouter.put(
  '/:id',
  activityLogger('Agent', 'Update Agen'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { name, phone, commissionRate, commissionType, isActive } = req.body;

    try {
      const target = await prisma.agent.findUnique({ where: { id } });
      if (!target) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Agen tidak ditemukan' });
        return;
      }

      const agent = await prisma.agent.update({
        where: { id },
        data: {
          name: name !== undefined ? name : target.name,
          phone: phone !== undefined ? phone : target.phone,
          commissionRate: commissionRate !== undefined ? parseFloat(commissionRate) : target.commissionRate,
          commissionType: commissionType !== undefined ? commissionType : target.commissionType,
          isActive: isActive !== undefined ? isActive : target.isActive,
        },
      });
      res.json({ status: 'success', data: agent, message: 'Agen berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memperbarui agen' });
    }
  }
);

// DELETE /api/agents/:id
agentsRouter.delete(
  '/:id',
  activityLogger('Agent', 'Nonaktifkan Agen'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    try {
      await prisma.agent.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ status: 'success', message: 'Agen berhasil dinonaktifkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menonaktifkan agen' });
    }
  }
);
