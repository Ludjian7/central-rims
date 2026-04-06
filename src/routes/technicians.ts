import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const techniciansRouter = Router();
techniciansRouter.use(authMiddleware);

// GET /api/technicians
techniciansRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { isActive } = req.query;
  const whereClause: any = {};
  
  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  } else {
    whereClause.isActive = true;
  }

  try {
    const technicians = await prisma.technician.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    res.json({ status: 'success', data: technicians, message: 'Data teknisi berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data teknisi' });
  }
});

// POST /api/technicians
techniciansRouter.post(
  '/',
  activityLogger('Technician', 'Tambah Teknisi'),
  async (req: AuthRequest, res: Response) => {
    const { name, phone, commissionRate } = req.body;

    if (!name) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Nama teknisi wajib diisi' });
      return;
    }

    try {
      const technician = await prisma.technician.create({
        data: { 
          name, 
          phone, 
          commissionRate: parseFloat(commissionRate || '0'),
          isActive: true 
        },
      });
      res.status(201).json({ status: 'success', data: technician, message: 'Teknisi berhasil ditambahkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menambah teknisi' });
    }
  }
);

// PUT /api/technicians/:id
techniciansRouter.put(
  '/:id',
  activityLogger('Technician', 'Update Teknisi'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { name, phone, commissionRate, isActive } = req.body;

    try {
      const target = await prisma.technician.findUnique({ where: { id } });
      if (!target) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Teknisi tidak ditemukan' });
        return;
      }

      const technician = await prisma.technician.update({
        where: { id },
        data: {
          name: name !== undefined ? name : target.name,
          phone: phone !== undefined ? phone : target.phone,
          commissionRate: commissionRate !== undefined ? parseFloat(commissionRate) : target.commissionRate,
          isActive: isActive !== undefined ? isActive : target.isActive,
        },
      });
      res.json({ status: 'success', data: technician, message: 'Teknisi berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memperbarui teknisi' });
    }
  }
);

// DELETE /api/technicians/:id
techniciansRouter.delete(
  '/:id',
  activityLogger('Technician', 'Nonaktifkan Teknisi'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    try {
      await prisma.technician.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ status: 'success', message: 'Teknisi berhasil dinonaktifkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menonaktifkan teknisi' });
    }
  }
);
