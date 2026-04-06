import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const suppliersRouter = Router();

// Protect all routes
suppliersRouter.use(authMiddleware);

// GET /api/suppliers
suppliersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { isActive } = req.query;
  const whereClause: any = {};
  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  } else {
    whereClause.isActive = true;
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    res.json({ status: 'success', data: suppliers, message: 'Data supplier berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data supplier' });
  }
});

// GET /api/suppliers/:id
suppliersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });
    if (!supplier) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Supplier tidak ditemukan' });
      return;
    }
    res.json({ status: 'success', data: supplier, message: 'Data supplier berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil detail supplier' });
  }
});

// POST /api/suppliers
suppliersRouter.post(
  '/',
  activityLogger('Supplier', 'Tambah Supplier'),
  async (req: AuthRequest, res: Response) => {
    const { name, phone, email, address } = req.body;

    if (!name) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Nama supplier wajib diisi' });
      return;
    }

    try {
      const supplier = await prisma.supplier.create({
        data: { name, phone, email, address, isActive: true },
      });
      res.status(201).json({ status: 'success', data: supplier, message: 'Supplier berhasil ditambahkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menambah supplier' });
    }
  }
);

// PUT /api/suppliers/:id
suppliersRouter.put(
  '/:id',
  activityLogger('Supplier', 'Update Supplier'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { name, phone, email, address, isActive } = req.body;

    try {
      const target = await prisma.supplier.findUnique({ where: { id } });
      if (!target) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Supplier tidak ditemukan' });
        return;
      }

      const supplier = await prisma.supplier.update({
        where: { id },
        data: {
          name: name !== undefined ? name : target.name,
          phone: phone !== undefined ? phone : target.phone,
          email: email !== undefined ? email : target.email,
          address: address !== undefined ? address : target.address,
          isActive: isActive !== undefined ? isActive : target.isActive,
        },
      });
      res.json({ status: 'success', data: supplier, message: 'Supplier berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memperbarui supplier' });
    }
  }
);

// DELETE /api/suppliers/:id (Soft-Delete)
suppliersRouter.delete(
  '/:id',
  activityLogger('Supplier', 'Nonaktifkan Supplier'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);

    try {
      await prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ status: 'success', message: 'Supplier berhasil dinonaktifkan (Soft Delete)' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menonaktifkan supplier' });
    }
  }
);
