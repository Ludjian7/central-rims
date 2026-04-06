import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const transactionsRouter = Router();
transactionsRouter.use(authMiddleware);

// GET /api/transactions
transactionsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
        shift: { select: { id: true, user: { select: { username: true } } } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Safe default
    });
    res.json({ status: 'success', data: transactions, message: 'Data transaksi berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data transaksi' });
  }
});

// GET /api/transactions/:id
transactionsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        customer: true,
        agent: true,
        shift: { include: { user: { select: { username: true } } } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });

    if (!transaction) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan' });
      return;
    }

    res.json({ status: 'success', data: transaction, message: 'Detail transaksi berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil detail transaksi' });
  }
});

// POST /api/transactions (Checkout POS)
transactionsRouter.post(
  '/',
  activityLogger('Transaction', 'Checkout Kasir (POS)'),
  async (req: AuthRequest, res: Response) => {
    // 1. Ambil data dari payload checkout
    const { 
      customerId, 
      agentId, 
      discountItem, 
      discountTotal, 
      paidAmount, 
      paymentMethod, 
      items // Array of { productId, qty, price, discount, subtotal }
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Keranjang belanja tidak boleh kosong' });
      return;
    }

    try {
      // 2. Validasi Active Shift milik user (Kasir)
      if (!req.user?.id) throw new Error('NO_USER_CONTEXT');
      
      const activeShift = await prisma.cashShift.findFirst({
        where: { userId: req.user.id, status: 'ACTIVE' },
      });

      if (!activeShift) {
        res.status(403).json({ status: 'error', code: 'NO_ACTIVE_SHIFT', message: 'Anda tidak memiliki shift kasir yang aktif' });
        return;
      }

      // 3. Eksekusi POS Logic dalam 1 transaksi DB atomic
      const result = await prisma.$transaction(async (tx) => {
        // Cek stok seluruh item sebelum memproses
        let subtotalAccumulated = 0;
        let totalCostAccumulated = 0;

        for (const item of items) {
          const checkProduct = await tx.product.findUnique({ where: { id: parseInt(item.productId, 10) } });
          if (!checkProduct) throw new Error(`PRODUCT_NOT_FOUND_${item.productId}`);
          if (checkProduct.stock < parseInt(item.qty, 10)) {
            throw new Error(`INSUFFICIENT_STOCK_${checkProduct.name}`);
          }
          subtotalAccumulated += (parseFloat(item.price) * parseInt(item.qty, 10)) - parseFloat(item.discount || '0');
          totalCostAccumulated += (checkProduct.cost * parseInt(item.qty, 10));
        }

        const globalSubtotal = subtotalAccumulated - parseFloat(discountItem || '0');
        const finalTotal = globalSubtotal - parseFloat(discountTotal || '0');
        const paid = parseFloat(paidAmount || '0');
        const transactionStatus = paid >= finalTotal ? 'LUNAS' : 'PIUTANG';

        // Generate Invoice Number otomatis
        const dateStr = new Date().toISOString().slice(0, 10).replace((/-/g as any), '');
        const count = await tx.transaction.count({
          where: { invoiceNumber: { startsWith: `INV-${dateStr}` } }
        });
        const invoiceNumber = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

        // Create Header Transaksi
        const trx = await tx.transaction.create({
          data: {
            invoiceNumber,
            shiftId: activeShift.id,
            customerId: customerId ? parseInt(customerId, 10) : null,
            agentId: agentId ? parseInt(agentId, 10) : null,
            subtotal: subtotalAccumulated,
            discountItem: parseFloat(discountItem || '0'),
            discountTotal: parseFloat(discountTotal || '0'),
            total: finalTotal,
            paidAmount: paid,
            paymentMethod: paymentMethod || 'cash',
            status: transactionStatus,
          }
        });

        // Create Item Transaksi & Potong Stok
        for (const item of items) {
          const qty = parseInt(item.qty, 10);
          const price = parseFloat(item.price);
          const discount = parseFloat(item.discount || '0');
          
          // Ambil HPP untuk disimpan stagnan di level Item transaksi
          const productCostInfo = await tx.product.findUnique({ where: { id: parseInt(item.productId, 10) }});

          await tx.transactionItem.create({
            data: {
              transactionId: trx.id,
              productId: parseInt(item.productId, 10),
              qty,
              cost: productCostInfo?.cost || 0,
              price,
              discount,
              subtotal: (price * qty) - discount,
              notes: item.notes || null,
            }
          });

          // Kurangi Master Produk Stok
          await tx.product.update({
            where: { id: parseInt(item.productId, 10) },
            data: { stock: { decrement: qty } }
          });

          // Log Mutasi
          await tx.stockMovement.create({
            data: {
              productId: parseInt(item.productId, 10),
              type: 'OUT',
              qty,
              referenceType: 'TRANSACTION',
              referenceId: trx.id,
              remarks: `Penjualan Kasir INV: ${invoiceNumber}`,
            }
          });
        }

        // --- HOOK: PENCIPTAAN PIUTANG ---
        if (transactionStatus === 'PIUTANG' && customerId) {
          const remainingDebt = finalTotal - paid;
          await tx.receivable.create({
            data: {
              referenceType: 'TRANSACTION',
              referenceId: trx.id,
              customerId: parseInt(customerId, 10),
              total: finalTotal,
              paidAmount: paid,
              remaining: remainingDebt,
              status: paid > 0 ? 'PARTIAL' : 'OPEN',
            }
          });
        } else if (transactionStatus === 'PIUTANG' && !customerId) {
          // Sistem RIMS biasanya mewajibkan identitas kalau ngutang
          throw new Error('CUSTOMER_REQUIRED_FOR_DEBT');
        }

        // --- HOOK: PENCIPTAAN KOMISI AGEN ---
        if (agentId) {
          const agentTarget = await tx.agent.findUnique({ where: { id: parseInt(agentId, 10) } });
          if (agentTarget && agentTarget.commissionRate > 0) {
            let commissionEarned = 0;
            if (agentTarget.commissionType === 'PERCENTAGE') {
              commissionEarned = (agentTarget.commissionRate / 100) * finalTotal;
            } else if (agentTarget.commissionType === 'FIXED') {
              commissionEarned = agentTarget.commissionRate;
            }

            if (commissionEarned > 0) {
              await tx.commission.create({
                data: {
                  referenceType: 'TRANSACTION',
                  referenceId: trx.id,
                  targetType: 'AGENT',
                  agentId: parseInt(agentId, 10),
                  amount: commissionEarned,
                }
              });
            }
          }
        }

        return trx;
      });

      res.status(201).json({ status: 'success', data: result, message: 'Transaksi berhasil diselesaikan' });
    } catch (error: any) {
      if (error.message.startsWith('INSUFFICIENT_STOCK_')) {
        const pName = error.message.split('INSUFFICIENT_STOCK_')[1];
        res.status(400).json({ status: 'error', code: 'STOCK_ERROR', message: `Stok produk ${pName} tidak mencukupi` });
      } else if (error.message === 'CUSTOMER_REQUIRED_FOR_DEBT') {
        res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Penjualan Piutang wajib memasukkan data Pelanggan' });
      } else {
        res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal memproses transaksi kasir' });
      }
    }
  }
);
