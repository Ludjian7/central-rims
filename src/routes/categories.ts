import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const categoriesRouter = Router();

// Protect all routes
categoriesRouter.use(authMiddleware);

// GET /api/categories
categoriesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    // LOG KHUSUS INVESTIGASI
    console.log('--- API DEBUG: Category 0 ---');
    if (categories.length > 0) {
       console.log('Example Category:', JSON.stringify(categories[0], null, 2));
    }
    res.json({ status: 'success', data: categories, message: 'Data kategori berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil kategori' });
  }
});

// POST /api/categories
categoriesRouter.post(
  '/',
  activityLogger('Category', 'Tambah Kategori'),
  async (req: AuthRequest, res: Response) => {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Nama kategori wajib diisi' });
      return;
    }

    try {
      const category = await prisma.category.create({
        data: { name, description },
      });
      res.status(201).json({ status: 'success', data: category, message: 'Kategori berhasil ditambahkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menambah kategori' });
    }
  }
);

// PUT /api/categories/:id
categoriesRouter.put(
  '/:id',
  activityLogger('Category', 'Update Kategori'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Nama kategori wajib diisi' });
      return;
    }

    try {
      const target = await prisma.category.findUnique({ where: { id } });
      if (!target) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Kategori tidak ditemukan' });
        return;
      }

      const category = await prisma.category.update({
        where: { id },
        data: { name, description },
      });
      res.json({ status: 'success', data: category, message: 'Kategori berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memperbarui kategori' });
    }
  }
);

// DELETE /api/categories/:id
categoriesRouter.delete(
  '/:id',
  activityLogger('Category', 'Hapus Kategori'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);

    try {
      // Check for related products before deleting
      const relatedProducts = await prisma.product.count({ where: { categoryId: id } });
      if (relatedProducts > 0) {
        res.status(400).json({ 
          status: 'error', 
          code: 'DEPENDENCY_ERROR', 
          message: 'Kategori tidak dapat dihapus karena masih digunakan oleh produk' 
        });
        return;
      }

      await prisma.category.delete({ where: { id } });
      res.json({ status: 'success', message: 'Kategori berhasil dihapus' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menghapus kategori' });
    }
  }
);
