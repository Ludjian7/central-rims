import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/index.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const usersRouter = Router();

// Middleware: all routes require Auth and MANAGER/OWNER roles
usersRouter.use(authMiddleware);
usersRouter.use(roleGuard(['OWNER', 'MANAGER']));

// GET /api/users
usersRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { id: 'asc' }
    });
    res.json({ status: 'success', data: users, message: 'Data pengguna berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengambil data pengguna' });
  }
});

// POST /api/users
usersRouter.post(
  '/', 
  activityLogger('User', 'Tambah Pengguna'), 
  async (req: AuthRequest, res: Response) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Semua field wajib diisi' });
      return;
    }

    try {
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] }
      });

      if (existingUser) {
        res.status(400).json({ status: 'error', code: 'DUPLICATE', message: 'Username atau Email sudah terdaftar' });
        return;
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: passwordHash,
          role,
          isActive: true
        },
        select: { id: true, username: true, email: true, role: true, isActive: true }
      });

      res.status(201).json({ status: 'success', data: newUser, message: 'Pengguna berhasil dibuat' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal membuat pengguna' });
    }
  }
);

// PUT /api/users/:id
usersRouter.put(
  '/:id', 
  activityLogger('User', 'Update Informasi Pengguna'), 
  async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id as string, 10);
    const { username, email, role, isActive } = req.body;

    try {
      // Prevent manager from making another owner or setting themselves to owner
      if (req.user?.role === 'MANAGER' && role === 'OWNER') {
        res.status(403).json({ status: 'error', code: 'FORBIDDEN', message: 'Manager tidak dapat assign role Owner' });
        return;
      }

      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' });
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          username,
          email,
          role,
          isActive: isActive !== undefined ? isActive : targetUser.isActive
        },
        select: { id: true, username: true, email: true, role: true, isActive: true }
      });

      res.json({ status: 'success', data: updatedUser, message: 'Informasi pengguna berhasil diupdate' });
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(400).json({ status: 'error', code: 'DUPLICATE', message: 'Username atau Email sudah terpakai' });
        return;
      }
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal mengupdate pengguna' });
    }
  }
);

// DELETE /api/users/:id (Soft Delete via Update)
usersRouter.delete(
  '/:id', 
  activityLogger('User', 'Nonaktifkan Pengguna'), 
  async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id as string, 10);

    try {
      if (userId === req.user?.id) {
        res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Tidak dapat menonaktifkan akun sendiri' });
        return;
      }

      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' });
        return;
      }

      // Prevent managers from deactivating an owner
      if (req.user?.role === 'MANAGER' && targetUser.role === 'OWNER') {
        res.status(403).json({ status: 'error', code: 'FORBIDDEN', message: 'Manager tidak dapat menonaktifkan Owner' });
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      });

      res.json({ status: 'success', message: 'Pengguna berhasil nonaktifkan' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Gagal menonaktifkan pengguna' });
    }
  }
);
