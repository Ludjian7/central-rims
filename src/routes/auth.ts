import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'rims-dev-secret-key-2025';

// POST /api/auth/login
authRouter.post('/login', async (req: AuthRequest, res: Response) => {
  const { email, username, password } = req.body;
  const identifier = email || username;
  
  if (!identifier || !password) {
    res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Email/Username dan password wajib diisi' });
    return;
  }

  try {
    const user = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { email: identifier },
          { username: identifier }
        ],
        isActive: true 
      } 
    });
    
    if (!user) {
      res.status(401).json({ status: 'error', code: 'AUTH_FAILED', message: 'Email atau password salah' });
      return;
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      res.status(401).json({ status: 'error', code: 'AUTH_FAILED', message: 'Email atau password salah' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any }
    );

    // Context for logger if needed
    req.user = { id: user.id, username: user.username, role: user.role };

    // Manual Log because the user context is defined AFTER middleware executes
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'Login Berhasil',
        resourceType: 'Auth',
        details: JSON.stringify({ ip: req.ip }),
      }
    });

    res.json({
      status: 'success',
      data: { token, user: { id: user.id, username: user.username, role: user.role, email: user.email } },
      message: 'Login berhasil'
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ 
      status: 'error', 
      code: 'SERVER_ERROR', 
      message: 'Terjadi kesalahan server'
    });
  }
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.user?.id } 
    });
    if (!user || !user.isActive) {
      res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'User tidak aktif atau tidak ditemukan' });
      return;
    }
    const { password, ...safeUser } = user;
    res.json({ status: 'success', data: safeUser, message: 'Data user berhasil diambil' });
  } catch (error) {
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' });
  }
});

// PATCH /api/auth/change-password
authRouter.patch(
  '/change-password', 
  authMiddleware, 
  activityLogger('Auth', 'Ganti Password Mandiri'),
  async (req: AuthRequest, res: Response) => {
    const { old_password, new_password } = req.body;
    
    if (!old_password || !new_password) {
      res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Password lama dan baru wajib diisi' });
      return;
    }

    try {
      if (!req.user?.id) throw new Error('User context missing');

      const user = await prisma.user.findUnique({ 
        where: { id: req.user.id },
        select: { password: true }
      });
      
      if (!user) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'User tidak ditemukan' });
        return;
      }

      const isValid = bcrypt.compareSync(old_password, user.password);
      if (!isValid) {
        res.status(400).json({ status: 'error', code: 'INVALID_PASSWORD', message: 'Password lama salah' });
        return;
      }

      const newHash = bcrypt.hashSync(new_password, 10);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: newHash }
      });

      res.json({ status: 'success', data: null, message: 'Password berhasil diubah' });
    } catch (error) {
      res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' });
    }
  }
);
