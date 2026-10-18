import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbManager } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'kadpoly_attendance_system_secure_jwt_secret_2026_salt_871923';
const TOKEN_EXPIRY = '7d';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'lecturer' | 'student';
  identifier?: string;
  department_id?: number;
  department_name?: string;
  level?: string;
  phone?: string;
  status: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): { id: number; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
  } catch (err) {
    return null;
  }
}

export function hashPassword(plainText: string): string {
  return bcrypt.hashSync(plainText, 10);
}

export function comparePassword(plainText: string, hashed: string): boolean {
  return bcrypt.compareSync(plainText, hashed);
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    return;
  }

  const user = dbManager.queryOne(`
    SELECT u.id, u.email, u.full_name, u.role, u.identifier, u.department_id, u.level, u.phone, u.status,
           d.name as department_name, d.code as department_code
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `, [payload.id]);

  if (!user || user.status !== 'active') {
    res.status(401).json({ error: 'User account not found or suspended.' });
    return;
  }

  req.user = user as AuthUser;
  next();
}

export function requireRole(...allowedRoles: Array<'admin' | 'lecturer' | 'student'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. You are [${req.user.role}].`
      });
      return;
    }
    next();
  };
}
