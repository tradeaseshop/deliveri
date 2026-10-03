import { Router } from 'express';
import crypto from 'crypto';
import db from '../db';
import { hashPassword, verifyPassword, signToken, requireRole } from '../auth';
import { toAdmin, toDriver } from '../serialize';

const router=Router();

router.post('/admin/login',(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase(); const password=String(req.body?.password||'');
  if(!email||!password) return res.status(400).json({error:'Email and password are required.'});
  const row=db.prepare('SELECT * FROM admins WHERE email=?').get(email) as any;
  if(!row || row.status!=='Active' || !verifyPassword(password,row.password_hash)) return res.status(401).json({error:'Invalid email or password.'});
  res.json({token:signToken({id:row.id,email:row.email,role:'admin'}),admin:toAdmin(row)});
});

router.post('/driver/login',(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase(); const password=String(req.body?.password||'');
  if(!email||!password) return res.status(400).json({error:'Email and password are required.'});
  const row=db.prepare('SELECT * FROM drivers WHERE email=?').get(email) as any;
  if(!row || !verifyPassword(password,row.password_hash)) return res.status(401).json({error:'Invalid email or password.'});
  if(row.approval_status==='Suspended') return res.status(403).json({error:'This driver account has been suspended.'});
  res.json({token:signToken({id:row.id,email:row.email,role:'driver'}),driver:toDriver(row)});
});

router.post('/switch-role',requireRole('admin','driver'),(req,res)=>{
  const target=String(req.body?.role||'').toLowerCase();
  if(target!=='admin'&&target!=='driver') return res.status(400).json({error:'Invalid workspace.'});
  const email=req.auth!.email.toLowerCase();
  if(target===req.auth!.role) return res.json({token:signToken(req.auth!),role:target});
  if(target==='admin'){
    const row=db.prepare("SELECT * FROM admins WHERE email=? AND status='Active'").get(email) as any;
    if(!row) return res.status(403).json({error:'No active admin account is linked to this email.'});
    return res.json({token:signToken({id:row.id,email:row.email,role:'admin'}),role:'admin',admin:toAdmin(row)});
  }
  const row=db.prepare("SELECT * FROM drivers WHERE email=? AND approval_status!='Suspended'").get(email) as any;
  if(!row) return res.status(403).json({error:'No active driver account is linked to this email.'});
  return res.json({token:signToken({id:row.id,email:row.email,role:'driver'}),role:'driver',driver:toDriver(row)});
});

router.get('/me',requireRole('admin','driver'),(req,res)=>{
  if(req.auth!.role==='admin'){
    const row=db.prepare('SELECT * FROM admins WHERE id=?').get(req.auth!.id) as any;
    if(!row||row.status!=='Active') return res.status(401).json({error:'Account is not active.'});
    const linked=db.prepare("SELECT id FROM drivers WHERE email=? AND approval_status!='Suspended'").get(row.email);
    return res.json({role:'admin',admin:toAdmin(row),availableRoles:linked?['admin','driver']:['admin']});
  }
  const row=db.prepare('SELECT * FROM drivers WHERE id=?').get(req.auth!.id) as any;
  if(!row) return res.status(401).json({error:'Account not found.'});
  const linked=db.prepare("SELECT id FROM admins WHERE email=? AND status='Active'").get(row.email);
  res.json({role:'driver',driver:toDriver(row),availableRoles:linked?['driver','admin']:['driver']});
});

router.post('/password/request',async(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(!email) return res.status(400).json({error:'Email is required.'});
  const admin=db.prepare('SELECT id,name,email FROM admins WHERE email=?').get(email) as any;
  const driver=db.prepare('SELECT id,name,email FROM drivers WHERE email=?').get(email) as any;
  const account=admin?{type:'admin',...admin}:driver?{type:'driver',...driver}:null;
  if(!account) return res.json({message:'If an account exists, a password reset link will be sent.'});
  const raw=crypto.randomBytes(32).toString('hex'); const hash=crypto.createHash('sha256').update(raw).digest('hex');
  db.prepare("DELETE FROM password_resets WHERE account_id=? OR expires_at<=datetime('now')").run(account.id);
  db.prepare("INSERT INTO password_resets(id,account_type,account_id,token_hash,expires_at) VALUES(?,?,?,?,datetime('now','+30 minutes'))").run(crypto.randomUUID(),account.type,account.id,hash);
  const base=process.env.APP_BASE_URL||''; const link=`${base.replace(/\/$/,'')}/reset-password?token=${raw}`;
  if(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL){
    await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.RESEND_API_KEY}`},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[account.email],subject:'DELIVERI password reset',html:`<p>Hello ${account.name},</p><p>Use this link to reset your DELIVERI password. It expires in 30 minutes.</p><p><a href="${link}">${link}</a></p>`})}).catch(e=>console.error('[password-reset]',e));
  }
  res.json({message:'If an account exists, a password reset link will be sent.'});
});

router.post('/password/reset',(req,res)=>{
  const token=String(req.body?.token||''); const password=String(req.body?.password||'');
  if(token.length<32||password.length<8) return res.status(400).json({error:'A valid token and password of at least 8 characters are required.'});
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const reset=db.prepare("SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>datetime('now')").get(hash) as any;
  if(!reset) return res.status(400).json({error:'Reset token is invalid or expired.'});
  const table=reset.account_type==='admin'?'admins':'drivers';
  db.prepare(`UPDATE ${table} SET password_hash=?, updated_at=datetime('now') WHERE id=?`).run(hashPassword(password),reset.account_id);
  db.prepare('UPDATE password_resets SET used_at=datetime(\'now\') WHERE id=?').run(reset.id);
  res.json({success:true});
});

export default router;
