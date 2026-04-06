import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const productsRouter = Router();
productsRouter.use(authMiddleware);

// GET /api/products
productsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { search, categoryId, isActive } = req.query;
  
  const whereClause: any = {};
  
  if (search) {
    whereClause.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { sku: { contains: search as string, mode: 'insensitive' } }
    ];
  }
  
  if (categoryId) {
    whereClause.categoryId = parseInt(categoryId as string, 10);
  }

  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  } else {
    // By default only fetch active ones unless specified
    whereClause.isActive = true;
  }

  try {
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ status: 'success', data: products, message: 'Data produk berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data produk' });
  }
});

// GET /api/products/:id
productsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      }
    });
    
    if (!product) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Produk tidak ditemukan' });
      return;
    }
    res.json({ status: 'success', data: product, message: 'Data produk berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil detail produk' });
  }
});

// POST /api/products
productsRouter.post(
  '/',
  activityLogger('Product', 'Tambah Produk'),
  async (req: AuthRequest, res: Response) => {
    const { categoryId, supplierId, sku, name, description, cost, price, stock, minStock } = req.body;

    if (!categoryId || !name) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Kategori dan nama produk wajib diisi' });
      return;
    }

    try {
      if (sku) {
        const existingCode = await prisma.product.findUnique({ where: { sku } });
        if (existingCode) {
          res.status(400).json({ status: 'error', code: 'DUPLICATE', message: 'SKU sudah digunakan produk lain' });
          return;
        }
      }

      const product = await prisma.product.create({
        data: {
          categoryId: parseInt(categoryId, 10),
          supplierId: supplierId ? parseInt(supplierId, 10) : null,
          sku: sku || null,
          name,
          description,
          cost: parseFloat(cost || '0'),
          price: parseFloat(price || '0'),
          stock: parseInt(stock || '0', 10),
          minStock: parseInt(minStock || '0', 10),
          isActive: true
        },
      });

      // Insert Initial Stock Movement if stock > 0
      if (product.stock > 0) {
        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            type: 'IN',
            qty: product.stock,
            referenceType: 'MANUAL',
            remarks: 'Stok Awal'
          }
        });
      }

      res.status(201).json({ status: 'success', data: product, message: 'Produk berhasil ditambahkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menambah produk' });
    }
  }
);

// PUT /api/products/:id
productsRouter.put(
  '/:id',
  activityLogger('Product', 'Update Produk'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { categoryId, supplierId, sku, name, description, cost, price, minStock, isActive } = req.body;

    try {
      const target = await prisma.product.findUnique({ where: { id } });
      if (!target) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Produk tidak ditemukan' });
        return;
      }

      if (sku && sku !== target.sku) {
        const existingCode = await prisma.product.findUnique({ where: { sku } });
        if (existingCode) {
          res.status(400).json({ status: 'error', code: 'DUPLICATE', message: 'SKU sudah digunakan produk lain' });
          return;
        }
      }

      const product = await prisma.product.update({
        where: { id },
        data: {
          categoryId: categoryId ? parseInt(categoryId, 10) : target.categoryId,
          supplierId: supplierId !== undefined ? (supplierId ? parseInt(supplierId, 10) : null) : target.supplierId,
          sku: sku !== undefined ? (sku || null) : target.sku,
          name: name !== undefined ? name : target.name,
          description: description !== undefined ? description : target.description,
          cost: cost !== undefined ? parseFloat(cost) : target.cost,
          price: price !== undefined ? parseFloat(price) : target.price,
          minStock: minStock !== undefined ? parseInt(minStock, 10) : target.minStock,
          isActive: isActive !== undefined ? isActive : target.isActive
        },
      });

      res.json({ status: 'success', data: product, message: 'Produk berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memperbarui produk' });
    }
  }
);

// DELETE /api/products/:id (Sesuai spec Phase 3: Soft-Delete)
productsRouter.delete(
  '/:id',
  activityLogger('Product', 'Nonaktifkan Produk'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);

    try {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ status: 'success', message: 'Produk berhasil dinonaktifkan (Soft Delete)' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menonaktifkan produk' });
    }
  }
);
