import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest, roleGuard } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';
import { POStatus } from '@prisma/client';

export const purchaseOrdersRouter = Router();
purchaseOrdersRouter.use(authMiddleware);

// GET /api/purchase-orders
purchaseOrdersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, supplierId } = req.query;
  const whereClause: any = {};

  if (status) whereClause.status = status as POStatus;
  if (supplierId) whereClause.supplierId = parseInt(supplierId as string, 10);

  try {
    const pos = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: pos, message: 'Data Purchase Order berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data PO' });
  }
});

// GET /api/purchase-orders/:id
purchaseOrdersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, stock: true } },
          },
        },
      },
    });

    if (!po) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Purchase Order tidak ditemukan' });
      return;
    }
    res.json({ status: 'success', data: po, message: 'Detail PO berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil detail PO' });
  }
});

// POST /api/purchase-orders (Create Draft)
purchaseOrdersRouter.post(
  '/',
  roleGuard(['OWNER', 'MANAGER']), // Kasir tidak bisa sembarangan buat PO
  activityLogger('PurchaseOrder', 'Buat Draft PO'),
  async (req: AuthRequest, res: Response) => {
    const { supplierId, items, expectedDate } = req.body;
    // items: Array of { productId, qty, expectedCost }

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Supplier dan minimal 1 item wajib diisi' });
      return;
    }

    try {
      const estimatedTotal = items.reduce((acc, item) => acc + (item.qty * (item.expectedCost || 0)), 0);

      // Membuat kode PO secara otomatis (Contoh: PO-YYYYMMDD-XXXX)
      const dateStr = new Date().toISOString().slice(0, 10).replace((/-/g as any), '');
      const count = await prisma.purchaseOrder.count({
        where: { poNumber: { startsWith: `PO-${dateStr}` } }
      });
      const poNumber = `PO-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: parseInt(supplierId, 10),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          estimatedTotal,
          items: {
            create: items.map(item => ({
              productId: parseInt(item.productId, 10),
              qty: parseInt(item.qty, 10),
              expectedCost: parseFloat(item.expectedCost || '0'),
            })),
          },
        },
        include: { items: true },
      });

      res.status(201).json({ status: 'success', data: po, message: 'Draft PO berhasil dibuat' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal membuat PO' });
    }
  }
);

// POST /api/purchase-orders/:id/receive (Receive items & update stock)
purchaseOrdersRouter.post(
  '/:id/receive',
  roleGuard(['OWNER', 'MANAGER']),
  activityLogger('PurchaseOrder', 'Penerimaan / Receive PO'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { receivedItems } = req.body; 
    // receivedItems: Array of { purchaseOrderItemId, actualQty, actualCost }

    if (!receivedItems || !Array.isArray(receivedItems) || receivedItems.length === 0) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Item penerimaan wajib disertakan' });
      return;
    }

    try {
      // Run the entire receive process in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const targetPo = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!targetPo) {
          throw new Error('PO_NOT_FOUND');
        }

        if (targetPo.status === 'COMPLETED') {
          throw new Error('PO_ALREADY_COMPLETED');
        }

        let totalActualCost = 0;

        // Process each received item
        for (const rItem of receivedItems) {
          const poItem = targetPo.items.find(i => i.id === parseInt(rItem.purchaseOrderItemId, 10));
          if (!poItem) continue; // Skip jika ID item tdk cocok

          const actualQty = parseInt(rItem.actualQty, 10);
          const actualCost = parseFloat(rItem.actualCost);
          
          if (actualQty > 0) {
            totalActualCost += (actualQty * actualCost);

            // Update item di PO
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                actualQty,
                actualCost,
              },
            });

            // Update stok & harga cost produk
            // Simplified Moving Average (Opsional bisa full overwrite jika preferensi toko begitu)
            // Di sini kita overwrite cost terakhir untuk kesederhanaan versi RIMS v2.
            await tx.product.update({
              where: { id: poItem.productId },
              data: {
                stock: { increment: actualQty },
                cost: actualCost, // Updated base cost master
              },
            });

            // Catat log stock movement
            await tx.stockMovement.create({
              data: {
                productId: poItem.productId,
                type: 'IN',
                qty: actualQty,
                referenceType: 'PURCHASE_ORDER',
                referenceId: targetPo.id,
                remarks: `Penerimaan barang dari PO: ${targetPo.poNumber}`,
              },
            });
          }
        }

        // Logic untuk menentukan status akhir (COMPLETED jika semua terpenuhi, PARTIAL jika kurang)
        let isFullyReceived = true;
        const totalItemsTarget = targetPo.items.length;
        let itemsFullyMatched = 0;

        for (const item of targetPo.items) {
          const receivedForThis = receivedItems.find(ri => parseInt(ri.purchaseOrderItemId) === item.id);
          const currentActual = (item.actualQty || 0) + (receivedForThis ? parseInt(receivedForThis.actualQty) : 0);
          if (currentActual < item.qty) {
            isFullyReceived = false;
          } else {
            itemsFullyMatched++;
          }
        }

        const finalStatus = isFullyReceived ? 'COMPLETED' : 'PARTIAL';

        // Update PO Status
        const updatedPo = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: finalStatus,
            actualTotal: totalActualCost,
            receivedDate: new Date(),
          },
        });

        return updatedPo;
      });

      res.json({ status: 'success', data: result, message: 'Barang berhasil diterima dan stok masuk' });
    } catch (error: any) {
      if (error.message === 'PO_NOT_FOUND') {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'PO tidak ditemukan' });
      } else if (error.message === 'PO_ALREADY_COMPLETED') {
        res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'PO sudah diselesaikan sebelumnya' });
      }
    }
  }
);

// PATCH /api/purchase-orders/:id/status
purchaseOrdersRouter.patch(
  '/:id/status',
  roleGuard(['OWNER', 'MANAGER']),
  activityLogger('PurchaseOrder', 'Update Status PO'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { status } = req.body;

    try {
      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { status },
      });
      res.json({ status: 'success', data: updated, message: `Status PO berhasil diubah menjadi ${status}` });
    } catch (error) {
      console.error('Update Status PO Error:', error);
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal update status PO' });
    }
  }
);

export default purchaseOrdersRouter;
