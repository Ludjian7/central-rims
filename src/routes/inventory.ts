import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';
import { StockMovementType } from '@prisma/client';

export const inventoryRouter = Router();
inventoryRouter.use(authMiddleware);

// GET /api/inventory/movements
inventoryRouter.get('/movements', async (req: AuthRequest, res: Response) => {
  const { productId, type } = req.query;
  const whereClause: any = {};

  if (productId) {
    whereClause.productId = parseInt(productId as string, 10);
  }
  if (type) {
    whereClause.type = type as StockMovementType;
  }

  try {
    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 on default fetch
    });
    res.json({ status: 'success', data: movements, message: 'Data pergerakan stok berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data pergerakan stok' });
  }
});

// POST /api/inventory/adjustment
inventoryRouter.post(
  '/adjustment',
  activityLogger('Inventory', 'Manual Stock Adjustment'),
  async (req: AuthRequest, res: Response) => {
    const { productId, adjustmentQty, remarks } = req.body;

    if (!productId || adjustmentQty === undefined) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'ID Produk dan jumlah penyesuaian wajib diisi' });
      return;
    }

    if (adjustmentQty === 0) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Jumlah penyesuaian tidak boleh nol' });
      return;
    }

    try {
      const product = await prisma.product.findUnique({ where: { id: parseInt(productId, 10) } });
      
      if (!product) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Produk tidak ditemukan' });
        return;
      }

      // Hitung stok baru
      const newStock = product.stock + adjustmentQty;
      if (newStock < 0) {
        res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Penyesuaian menyebabkan stok menjadi negatif' });
        return;
      }

      // Jalankan transaksi (pemasukan data atomic)
      const result = await prisma.$transaction(async (tx) => {
        // 1. Update product stock
        const updatedProduct = await tx.product.update({
          where: { id: product.id },
          data: { stock: newStock },
        });

        // 2. Insert into stock movement
        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: 'ADJUSTMENT',
            qty: Math.abs(adjustmentQty), // We store positive absolute value
            referenceType: 'MANUAL',
            remarks: remarks || `Penyesuaian stok manual: ${adjustmentQty > 0 ? '+' : '-'}${Math.abs(adjustmentQty)}`,
          },
        });

        return { product: updatedProduct, movement };
      });

      res.status(201).json({ status: 'success', data: result, message: 'Penyesuaian stok berhasil disimpan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal melakukan penyesuaian stok' });
    }
  }
);
