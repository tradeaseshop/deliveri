import 'dotenv/config';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import db from './db';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? '' : 'deliveri-dev-secret-change-me');
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set. Set a long random string in the environment before starting DELIVERI in production.');
const TOKEN_TTL = '30d';

export interface AuthTokenPayload { id:string; email:string; role:'admin'|'driver'; }
export function hashPassword(password:string){ return bcrypt.hashSync(password, 12); }
export function verifyPassword(password:string, hash:string){ return bcrypt.compareSync(password, hash); }
export function signToken(payload:AuthTokenPayload){ return jwt.sign(payload, JWT_SECRET, {expiresIn:TOKEN_TTL}); }
export function verifyToken(token:string):AuthTokenPayload|null { try{return jwt.verify(token,JWT_SECRET) as AuthTokenPayload;}catch{return null;} }

declare global { namespace Express { interface Request { auth?: AuthTokenPayload } } }
function extractToken(req:Request){ const h=req.headers.authorization; return h?.startsWith('Bearer ')?h.slice(7):null; }

export function requireAuth(req:Request,res:Response,next:NextFunction){
  const token=extractToken(req); const payload=token?verifyToken(token):null;
  if(!payload) return res.status(401).json({error:'Authentication required'});
  req.auth=payload; next();
}
export function requireRole(...roles:Array<'admin'|'driver'>){
  return (req:Request,res:Response,next:NextFunction)=>{
    const token=extractToken(req); const payload=token?verifyToken(token):null;
    if(!payload) return res.status(401).json({error:'Authentication required'});
    if(!roles.includes(payload.role)) return res.status(403).json({error:'Insufficient permissions'});
    req.auth=payload; next();
  };
}

export const ADMIN_RANK:Record<string,number>={ 'Office Assistant':1, Dispatcher:2, Manager:3, 'Super Admin':4 };
export function requireAdminLevel(minRank:number){
  return (req:Request,res:Response,next:NextFunction)=>{
    const token=extractToken(req); const payload=token?verifyToken(token):null;
    if(!payload) return res.status(401).json({error:'Authentication required'});
    if(payload.role!=='admin') return res.status(403).json({error:'Admin access required'});
    const row=db.prepare('SELECT role,status FROM admins WHERE id=?').get(payload.id) as any;
    const rank=row?.role ? ADMIN_RANK[row.role]||0 : 0;
    if(row?.status!=='Active' || rank<minRank) return res.status(403).json({error:'Your admin role does not have permission to do this'});
    req.auth=payload; next();
  };
}
