import { Router, Response } from 'express';
import { prisma } from '../db/index.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const settingsRouter = Router();

// Middleware: all routes require Auth and OWNER/MANAGER roles. 
// Kasir typically doesn't manage store settings.
settingsRouter.use(authMiddleware);

// Endpoint GET settings boleh diakses oleh KASIR karena bisa jadi UI POS membutuhkan alamat/nama toko.
settingsRouter.get('/', async (_req, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    // Konversi key-value array ke object { STORE_NAME: 'Toko', STORE_PHONE: '08...' }
    const settingsObj = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    res.json({ status: 'success', data: settingsObj, message: 'Data pengaturan berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil pengaturan' });
  }
});

// Endpoint PUT /bulk wajib dijaga oleh Role
settingsRouter.put(
  '/bulk',
  roleGuard(['OWNER', 'MANAGER']),
  activityLogger('Setting', 'Update Pengaturan Toko'),
  async (req: AuthRequest, res: Response) => {
    // req.body diharapkan berupa object: { STORE_NAME: 'A', STORE_PHONE: 'B', ... }
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Payload tidak valid' });
      return;
    }

    try {
      // Upsert semua key
      const keys = Object.keys(payload);
      
      const upserts = keys.map((key) => {
        return prisma.setting.upsert({
          where: { key },
          update: { value: String(payload[key]) },
          create: { key, value: String(payload[key]) }
        });
      });

      await prisma.$transaction(upserts);

      // fetch updated data
      const updatedSettings = await prisma.setting.findMany();
      res.json({ status: 'success', data: updatedSettings, message: 'Pengaturan berhasil diperbarui' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengupdate pengaturan' });
    }
  }
);
