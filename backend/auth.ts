import 'dotenv/config';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import db from './db';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// In production this must come from a real env var — silently falling back
// to a hardcoded string would mean every deployment that forgets to set
// JWT_SECRET issues forgeable tokens. Fail fast at startup instead, so a
// missing secret is a deploy-time error, not a silent security hole.
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? '' : 'deliveri-dev-secret-change-me');
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. Set a long random string for JWT_SECRET in your environment (Railway: Variables tab) before starting the server in production.'
  );
}

const TOKEN_TTL = '30d';

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: 'admin' | 'driver';
  availableRoles?: Array<'admin' | 'driver'>;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}
export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'Authentication required' });
  req.auth = payload;
  next();
}

export function requireRole(...roles: Array<'admin' | 'driver'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(payload.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    req.auth = payload;
    next();
  };
}

// --- Admin sub-role authorization ---
//
// The 'admin' vs 'driver' split above only tells us someone is *some* kind
// of admin. The admins table also stores a sub-role (Super Admin, Manager,
// Dispatcher, Office Assistant) that used to be stored but never checked
// anywhere — meaning any admin account, including the lowest-privilege one,
// could add other admins or wipe the whole database. This ranks the
// sub-roles and gives routes a way to require a minimum level, the same way
// TradeEase's requireAdminLevel middleware gates its Manager/Office
// Assistant split.
export const ADMIN_RANK: Record<string, number> = {
  'Office Assistant': 1,
  Dispatcher: 2,
  Manager: 3,
  'Super Admin': 4,
};

export function requireAdminLevel(minRank: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: 'Authentication required' });
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Insufficient permissions' });

    const row = db.prepare('SELECT role FROM admins WHERE id = ?').get(payload.id) as { role?: string } | undefined;
    const rank = row?.role ? ADMIN_RANK[row.role] ?? 0 : 0;
    if (rank < minRank) {
      return res.status(403).json({ error: 'Your admin role does not have permission to do this' });
    }
    req.auth = payload;
    next();
  };
}
