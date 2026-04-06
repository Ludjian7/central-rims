import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';
import { WorkOrderStatus } from '@prisma/client';

export const workOrdersRouter = Router();
workOrdersRouter.use(authMiddleware);

// GET /api/work-orders
workOrdersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, technicianId, customerId, page = '1', limit = '20', search = '' } = req.query;
  const whereClause: any = {};

  if (status) whereClause.status = status as WorkOrderStatus;
  if (technicianId) whereClause.technicianId = parseInt(technicianId as string, 10);
  if (customerId) whereClause.customerId = parseInt(customerId as string, 10);
  
  if (search) {
    whereClause.OR = [
      { woNumber: { contains: search as string } },
      { deviceBrand: { contains: search as string } },
      { deviceModel: { contains: search as string } },
      { customer: { name: { contains: search as string } } },
      { customer: { phone: { contains: search as string } } },
    ];
  }

  const p = parseInt(page as string, 10);
  const l = parseInt(limit as string, 10);
  const skip = (p - 1) * l;

  try {
    const [wos, totalCount] = await Promise.all([
      prisma.workOrder.findMany({
        where: whereClause,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          technician: { select: { id: true, name: true } },
          _count: { select: { serviceItems: true, sparepartItems: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      prisma.workOrder.count({ where: whereClause })
    ]);

    res.json({ 
      status: 'success', 
      data: wos, 
      meta: {
        total: totalCount,
        page: p,
        limit: l,
        hasMore: skip + wos.length < totalCount
      },
      message: 'Data Jasa Service berhasil diambil' 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data Jasa Service' });
  }
});

// GET /api/work-orders/:id
workOrdersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  try {
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        technician: true,
        shift: { include: { user: { select: { username: true } } } },
        serviceItems: true,
        sparepartItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });

    if (!wo) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'WO tidak ditemukan' });
      return;
    }
    res.json({ status: 'success', data: wo, message: 'Data detail WO berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil detail WO' });
  }
});

// POST /api/work-orders (Intake Masuk)
workOrdersRouter.post(
  '/',
  activityLogger('WorkOrder', 'Terima Servisan Baru'),
  async (req: AuthRequest, res: Response) => {
    const { customerId, deviceType, deviceBrand, deviceModel, serialNumber, complaints, technicianId, notes } = req.body;

    if (!customerId || !deviceType || !complaints || !technicianId) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Customer, Tipe Barang, Keluhan, dan Teknisi wajib diisi' });
      return;
    }

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace((/-/g as any), '');
      const count = await prisma.workOrder.count({
        where: { woNumber: { startsWith: `WO-${dateStr}` } }
      });
      const woNumber = `WO-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

      const wo = await prisma.workOrder.create({
        data: {
          woNumber,
          customerId: parseInt(customerId, 10),
          deviceType,
          deviceBrand,
          deviceModel,
          serialNumber,
          complaints,
          technicianId: parseInt(technicianId, 10),
          status: 'MASUK',
          notes,
        }
      });
      res.status(201).json({ status: 'success', data: wo, message: 'Jasa Service berhasil dicetak' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mencetak Jasa Service' });
    }
  }
);

// PUT /api/work-orders/:id (Update Status/Notes)
workOrdersRouter.put(
  '/:id',
  activityLogger('WorkOrder', 'Update Status/Data WO'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { status, notes, technicianId, serviceItems, sparepartItems } = req.body;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Update Header
        const updatedWo = await tx.workOrder.update({
          where: { id },
          data: {
            status: status as WorkOrderStatus,
            notes: notes !== undefined ? notes : undefined,
            technicianId: technicianId ? parseInt(technicianId, 10) : undefined,
          }
        });

        // 2. Clear and Re-sync items if provided (allows saving progress before checkout)
        if (serviceItems && Array.isArray(serviceItems)) {
          await tx.workOrderServiceItem.deleteMany({ where: { workOrderId: id } });
          for (const svc of serviceItems) {
            await tx.workOrderServiceItem.create({
              data: {
                workOrderId: id,
                name: svc.name,
                price: parseFloat(svc.price),
                qty: parseInt(svc.qty, 10),
                subtotal: parseFloat(svc.price) * parseInt(svc.qty, 10),
                notes: svc.notes,
              }
            });
          }
        }

        if (sparepartItems && Array.isArray(sparepartItems)) {
          await tx.workOrderSparepartItem.deleteMany({ where: { workOrderId: id } });
          for (const sp of sparepartItems) {
            const prod = await tx.product.findUnique({ where: { id: parseInt(sp.productId, 10) } });
            await tx.workOrderSparepartItem.create({
              data: {
                workOrderId: id,
                productId: parseInt(sp.productId, 10),
                cost: prod?.cost || 0,
                price: parseFloat(sp.price),
                qty: parseInt(sp.qty, 10),
                subtotal: parseFloat(sp.price) * parseInt(sp.qty, 10),
                notes: sp.notes,
              }
            });
          }
        }

        return updatedWo;
      });

      res.json({ status: 'success', data: result, message: 'Jasa Service berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memperbarui Jasa Service' });
    }
  }
);

// POST /api/work-orders/:id/checkout (Selesai Servis, Serahkan ke Customer, Bayar)
workOrdersRouter.post(
  '/:id/checkout',
  activityLogger('WorkOrder', 'Checkout & Serah Terima Servisan'),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { discount, paidAmount, paymentMethod, serviceItems, sparepartItems } = req.body;
    // serviceItems: [{ name, price, qty }]
    // sparepartItems: [{ productId, price, qty }]

    try {
      if (!req.user?.id) throw new Error('Unauthenticated');

      const activeShift = await prisma.cashShift.findFirst({
        where: { userId: req.user.id, status: 'ACTIVE' },
      });

      if (!activeShift) {
        res.status(403).json({ status: 'error', code: 'NO_ACTIVE_SHIFT', message: 'Anda harus memiliki shift kasir aktif untuk memproses pembayaran WO' });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const wo = await tx.workOrder.findUnique({ where: { id } });
        if (!wo) throw new Error('WO_NOT_FOUND');
        if (wo.status === 'DIAMBIL') throw new Error('ALREADY_CHECKED_OUT');

        let accumulatedServiceTotal = 0;
        let accumulatedSparepartTotal = 0;

        // 1. Validasi Stok dan akumulasi nominal barang
        if (sparepartItems && Array.isArray(sparepartItems)) {
          for (const sp of sparepartItems) {
            const product = await tx.product.findUnique({ where: { id: parseInt(sp.productId, 10) } });
            if (!product) throw new Error(`PRODUCT_NOT_FOUND_${sp.productId}`);
            if (product.stock < parseInt(sp.qty, 10)) throw new Error(`INSUFFICIENT_STOCK_${product.name}`);
            
            accumulatedSparepartTotal += (parseFloat(sp.price) * parseInt(sp.qty, 10));
          }
        }

        // 2. Akumulasi Service Total
        if (serviceItems && Array.isArray(serviceItems)) {
          for (const svc of serviceItems) {
            accumulatedServiceTotal += (parseFloat(svc.price) * parseInt(svc.qty, 10));
          }
        }

        const subtotal = accumulatedServiceTotal + accumulatedSparepartTotal;
        const total = subtotal - parseFloat(discount || '0');
        const paid = parseFloat(paidAmount || '0');
        const transactionStatus = paid >= total ? 'DIAMBIL' : 'DIAMBIL'; // WO Status always taken when checked out

        // 3. Clear existing items if any (rebuild from scratch based on checkout state to ensure clean sync)
        await tx.workOrderServiceItem.deleteMany({ where: { workOrderId: id } });
        await tx.workOrderSparepartItem.deleteMany({ where: { workOrderId: id } });

        // 4. Update Header WO
        const updatedWo = await tx.workOrder.update({
          where: { id },
          data: {
            shiftId: activeShift.id,
            status: transactionStatus,
            subtotal,
            discount: parseFloat(discount || '0'),
            total,
            paidAmount: paid,
            paymentMethod: paymentMethod || 'cash',
            checkoutDate: new Date(),
          }
        });

        // 5. Insert Services
        if (serviceItems && Array.isArray(serviceItems)) {
          for (const svc of serviceItems) {
            await tx.workOrderServiceItem.create({
              data: {
                workOrderId: id,
                name: svc.name,
                price: parseFloat(svc.price),
                qty: parseInt(svc.qty, 10),
                subtotal: parseFloat(svc.price) * parseInt(svc.qty, 10),
                notes: svc.notes,
              }
            });
          }
        }

        // 6. Insert Spareparts and Deduct Stock securely
        if (sparepartItems && Array.isArray(sparepartItems)) {
          for (const sp of sparepartItems) {
            const baseProduct = await tx.product.findUnique({ where: { id: parseInt(sp.productId, 10) }});
            
            await tx.workOrderSparepartItem.create({
              data: {
                workOrderId: id,
                productId: parseInt(sp.productId, 10),
                cost: baseProduct?.cost || 0,
                price: parseFloat(sp.price),
                qty: parseInt(sp.qty, 10),
                subtotal: parseFloat(sp.price) * parseInt(sp.qty, 10),
                notes: sp.notes,
              }
            });

            await tx.product.update({
              where: { id: parseInt(sp.productId, 10) },
              data: { stock: { decrement: parseInt(sp.qty, 10) } }
            });

            await tx.stockMovement.create({
              data: {
                productId: parseInt(sp.productId, 10),
                type: 'OUT',
                qty: parseInt(sp.qty, 10),
                referenceType: 'WORK_ORDER',
                referenceId: id,
                remarks: `Suku Cadang WO: ${wo.woNumber}`,
              }
            });
          }
        }

        // --- HOOK: PENCIPTAAN PIUTANG JIKA KASBON ---
        if (paid < total) {
          await tx.receivable.create({
            data: {
              referenceType: 'WORK_ORDER',
              referenceId: id,
              customerId: wo.customerId,
              total,
              paidAmount: paid,
              remaining: total - paid,
              status: paid > 0 ? 'PARTIAL' : 'OPEN',
            }
          });
        }

        // --- HOOK: PENCIPTAAN KOMISI TEKNISI ---
        // Komisi teknisi di RIMS seringkali hanya dihitung dari pendapatan JASA, buka Sparepart. Tapi dikembalikan ke konvensi toko.
        // Asumsi standar: Komisi Teknisi dihitung dari Subtotal Jasa (Service Item) atau tarif tetap yang diset.
        // Di sini kita hitung persentase dari Total Jasa perbaikan.
        const tech = await tx.technician.findUnique({ where: { id: wo.technicianId } });
        if (tech && tech.commissionRate > 0 && accumulatedServiceTotal > 0) {
          const commissionEarned = (tech.commissionRate / 100) * accumulatedServiceTotal;
          await tx.commission.create({
            data: {
              referenceType: 'WORK_ORDER',
              referenceId: id,
              targetType: 'TECHNICIAN',
              technicianId: tech.id,
              amount: commissionEarned,
            }
          });
        }

        return updatedWo;
      });

      res.status(200).json({ status: 'success', data: result, message: 'WO Berhasil Di-checkout dan Diserahkan' });
    } catch (error: any) {
      if (error.message.startsWith('INSUFFICIENT_STOCK_')) {
        const pName = error.message.split('INSUFFICIENT_STOCK_')[1];
        res.status(400).json({ status: 'error', code: 'STOCK_ERROR', message: `Stok komponen/sparepart ${pName} tidak mencukupi` });
      } else if (error.message === 'WO_NOT_FOUND') {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Data WO tidak ditemukan' });
      } else if (error.message === 'ALREADY_CHECKED_OUT') {
        res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'WO sudah ditandai selesai dan diambil sebelumnya' });
      } else {
        res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memproses Checkout WO' });
      }
    }
  }
);
