import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: Role;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'rims-dev-secret-key-2025';

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Akses ditolak. Token tidak ditemukan.',
    });
    return; // Fast return
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Token tidak valid atau sudah kadaluarsa.',
    });
    return;
  }
};

export const roleGuard = (allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Akses ditolak. Silakan login kembali.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: 'Akses ditolak. Role tidak memiliki izin.',
      });
      return;
    }

    next();
  };
};
