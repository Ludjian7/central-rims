import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';
import { CustomerType } from '@prisma/client';

export const customersRouter = Router();

customersRouter.use(authMiddleware);

// GET /api/customers
customersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { search, type, isActive } = req.query;
  const whereClause: any = {};
  
  if (search) {
    whereClause.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  if (type) {
    whereClause.type = type as CustomerType;
  }

  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  } else {
    whereClause.isActive = true;
  }

  try {
    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    res.json({ status: 'success', data: customers, message: 'Data pelanggan berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data pelanggan' });
  }
});

// GET /api/customers/:id
customersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Pelanggan tidak ditemukan' });
      return;
    }
    res.json({ status: 'success', data: customer, message: 'Data pelanggan berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil detail pelanggan' });
  }
});

// POST /api/customers
customersRouter.post(
  '/',
  activityLogger('Customer', 'Tambah Pelanggan'),
  async (req: AuthRequest, res: Response) => {
    const { name, phone, email, address, type } = req.body;

    if (!name) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Nama pelanggan wajib diisi' });
      return;
    }

    try {
      const customer = await prisma.customer.create({
        data: { 
          name, 
          phone, 
          email, 
          address, 
          type: (type as CustomerType) || 'RETAIL',
          isActive: true 
        },
      });
      res.status(201).json({ status: 'success', data: customer, message: 'Pelanggan berhasil ditambahkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menambah pelanggan' });
    }
  }
);

// PUT /api/customers/:id
customersRouter.put(
  '/:id',
  activityLogger('Customer', 'Update Pelanggan'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { name, phone, email, address, type, isActive } = req.body;

    try {
      const target = await prisma.customer.findUnique({ where: { id } });
      if (!target) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Pelanggan tidak ditemukan' });
        return;
      }

      const customer = await prisma.customer.update({
        where: { id },
        data: {
          name: name !== undefined ? name : target.name,
          phone: phone !== undefined ? phone : target.phone,
          email: email !== undefined ? email : target.email,
          address: address !== undefined ? address : target.address,
          type: type !== undefined ? type : target.type,
          isActive: isActive !== undefined ? isActive : target.isActive,
        },
      });
      res.json({ status: 'success', data: customer, message: 'Pelanggan berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memperbarui pelanggan' });
    }
  }
);

// DELETE /api/customers/:id
customersRouter.delete(
  '/:id',
  activityLogger('Customer', 'Nonaktifkan Pelanggan'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    try {
      await prisma.customer.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ status: 'success', message: 'Pelanggan berhasil dinonaktifkan (Soft Delete)' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menonaktifkan pelanggan' });
    }
  }
);
