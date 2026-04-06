import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const expensesRouter = Router();
expensesRouter.use(authMiddleware);

// GET /api/expenses/categories
expensesRouter.get('/categories', async (_req, res) => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ status: 'success', data: categories, message: 'Kategori pengeluaran berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil kategori pengeluaran' });
  }
});

// POST /api/expenses/categories
expensesRouter.post(
  '/categories',
  activityLogger('ExpenseCategory', 'Tambah Kategori Pengeluaran'),
  async (req: AuthRequest, res: Response) => {
    const { name, description } = req.body;
    try {
      const category = await prisma.expenseCategory.create({
        data: { name, description },
      });
      res.status(201).json({ status: 'success', data: category, message: 'Kategori berhasil ditambahkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menambah kategori' });
    }
  }
);

// GET /api/expenses (List expenses specific to the current active shift or global based on filters)
expensesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { shiftId } = req.query;
  const whereClause: any = {};
  
  if (shiftId) whereClause.shiftId = parseInt(shiftId as string, 10);

  try {
    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: { category: true, shift: { include: { user: { select: { username: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ status: 'success', data: expenses, message: 'Data pengeluaran berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data pengeluaran' });
  }
});

// POST /api/expenses
expensesRouter.post(
  '/',
  activityLogger('Expense', 'Input Kas Keluar'),
  async (req: AuthRequest, res: Response) => {
    const { categoryId, amount, description, paymentMethod } = req.body;

    if (!categoryId || amount === undefined || amount <= 0) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Kategori dan jumlah pengeluaran valid wajib diisi' });
      return;
    }

    try {
      if (!req.user?.id) throw new Error('Unauthenticated');

      const activeShift = await prisma.cashShift.findFirst({
        where: { userId: req.user.id, status: 'ACTIVE' },
      });

      if (!activeShift) {
        res.status(403).json({ status: 'error', code: 'NO_ACTIVE_SHIFT', message: 'Anda harus memiliki shift aktif untuk input kasbon/pengeluaran' });
        return;
      }

      const expense = await prisma.expense.create({
        data: {
          shiftId: activeShift.id,
          categoryId: parseInt(categoryId, 10),
          amount: parseFloat(amount),
          description,
          paymentMethod: paymentMethod || 'cash',
        },
      });

      res.status(201).json({ status: 'success', data: expense, message: 'Pengeluaran kas berhasil dicatat' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mencatat pengeluaran' });
    }
  }
);

// PUT /api/expenses/:id
expensesRouter.put(
  '/:id',
  activityLogger('Expense', 'Update Pengeluaran'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { categoryId, amount, description, paymentMethod } = req.body;

    try {
      const expense = await prisma.expense.update({
        where: { id },
        data: {
          ...(categoryId ? { categoryId: parseInt(categoryId, 10) } : {}),
          ...(amount !== undefined ? { amount: parseFloat(amount) } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
        },
      });
      res.json({ status: 'success', data: expense, message: 'Pengeluaran berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memperbarui pengeluaran' });
    }
  }
);

// DELETE /api/expenses/:id
expensesRouter.delete(
  '/:id',
  activityLogger('Expense', 'Hapus Pengeluaran'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    try {
      await prisma.expense.delete({ where: { id } });
      res.json({ status: 'success', message: 'Pengeluaran berhasil dihapus' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menghapus pengeluaran' });
    }
  }
);
