import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../db';
import { toAdmin } from '../serialize';
import { hashPassword, requireRole, requireAdminLevel, ADMIN_RANK } from '../auth';
import { insertWithUniqueId } from '../ids';
import { runSeed } from '../seed';

const router=Router();

router.get('/',requireRole('admin'),(_req,res)=>{
  const rows=db.prepare('SELECT * FROM admins ORDER BY created_at DESC').all();
  res.json(rows.map(toAdmin));
});

router.post('/',requireAdminLevel(ADMIN_RANK['Super Admin']),(req,res)=>{
  const b=req.body||{};
  if(!b.name||!b.email||!b.password||!b.role) return res.status(400).json({error:'Legal name, email, role and password are required.'});
  if(String(b.password).length<8) return res.status(400).json({error:'Password must be at least 8 characters.'});
  const allowed=['Manager','Office Assistant','Dispatcher'];
  if(!allowed.includes(String(b.role))) return res.status(400).json({error:'Invalid admin role.'});
  const email=String(b.email).trim().toLowerCase();
  if(db.prepare('SELECT id FROM admins WHERE email=?').get(email)) return res.status(409).json({error:'An admin account with this email already exists.'});
  const {id}=insertWithUniqueId('ADM',id=>db.prepare(`INSERT INTO admins(id,name,email,password_hash,role,office_location,phone,address,status,avatar) VALUES(?,?,?,?,?,?,?,?,'Active',?)`).run(id,String(b.name).trim(),email,hashPassword(String(b.password)),b.role,b.officeLocation||null,b.phone||null,b.address||null,b.avatar||null));
  db.prepare(`INSERT INTO audit_logs(id,actor_type,actor_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).run(randomUUID(),'admin',req.auth!.id,'create','admin',id,JSON.stringify({role:b.role,email}));
  res.status(201).json(toAdmin(db.prepare('SELECT * FROM admins WHERE id=?').get(id)));
});

router.post('/reset-demo',requireAdminLevel(ADMIN_RANK['Super Admin']),(_req,res)=>{
  if(process.env.ALLOW_DEMO_RESET!=='true') return res.status(403).json({error:'Database reset is disabled.'});
  try{runSeed();res.json({success:true});}catch(e){console.error(e);res.status(500).json({error:'Database reset failed.'});}
});

export default router;
