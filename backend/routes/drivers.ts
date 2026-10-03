import { Router } from 'express';
import db from '../db';
import { toDriver } from '../serialize';
import { hashPassword, requireRole, requireAdminLevel, ADMIN_RANK } from '../auth';
import { insertWithUniqueId } from '../ids';

const router=Router();
router.get('/',requireRole('admin'),(_req,res)=>res.json((db.prepare('SELECT * FROM drivers ORDER BY created_at DESC').all() as any[]).map(toDriver)));

router.post('/',requireRole('admin'),(req,res)=>{
  const b=req.body||{};
  const required=['name','email','phone','password','vehicleType','vehiclePlate','idType','idNumber'];
  if(required.some(k=>!b[k])) return res.status(400).json({error:'Legal name, email, phone, password, ID details and vehicle details are required.'});
  if(String(b.password).length<8) return res.status(400).json({error:'Password must be at least 8 characters.'});
  const email=String(b.email).trim().toLowerCase();
  if(db.prepare('SELECT id FROM drivers WHERE email=?').get(email)) return res.status(409).json({error:'A driver account with this email already exists.'});
  const {id}=insertWithUniqueId('DRV',id=>db.prepare(`INSERT INTO drivers(id,name,phone,address,email,password_hash,vehicle_type,vehicle_plate,vehicle_model,vehicle_color,vehicle_year,id_type,id_number,id_document,emergency_contact,status,approval_status,current_lat,current_lng,avatar) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Offline','Approved',6.4584,7.5083,?)`).run(
    id,String(b.name).trim(),String(b.phone).trim(),b.address||null,email,hashPassword(String(b.password)),b.vehicleType,b.vehiclePlate,b.vehicleModel||null,b.vehicleColor||null,b.vehicleYear?Number(b.vehicleYear):null,b.idType,b.idNumber,b.idDocument||null,b.emergencyContact||null,b.avatar||null
  ));
  res.status(201).json(toDriver(db.prepare('SELECT * FROM drivers WHERE id=?').get(id)));
});

router.put('/:id/approve',requireAdminLevel(ADMIN_RANK.Dispatcher),(req,res)=>{ const row=db.prepare('SELECT id FROM drivers WHERE id=?').get(req.params.id); if(!row)return res.status(404).json({error:'Driver not found'}); db.prepare("UPDATE drivers SET approval_status='Approved' WHERE id=?").run(req.params.id); res.json(toDriver(db.prepare('SELECT * FROM drivers WHERE id=?').get(req.params.id))); });
router.put('/:id/suspend',requireAdminLevel(ADMIN_RANK.Dispatcher),(req,res)=>{ const row=db.prepare('SELECT id FROM drivers WHERE id=?').get(req.params.id); if(!row)return res.status(404).json({error:'Driver not found'}); db.prepare("UPDATE drivers SET approval_status='Suspended',status='Offline' WHERE id=?").run(req.params.id); res.json(toDriver(db.prepare('SELECT * FROM drivers WHERE id=?').get(req.params.id))); });
router.put('/me/status',requireRole('driver'),(req,res)=>{const d=db.prepare('SELECT approval_status FROM drivers WHERE id=?').get(req.auth!.id) as any;if(!d)return res.status(404).json({error:'Driver not found'});if(req.body?.online&&d.approval_status!=='Approved')return res.status(403).json({error:'Your driver account must be approved before going online.'});db.prepare('UPDATE drivers SET status=? WHERE id=?').run(req.body?.online?'Online':'Offline',req.auth!.id);res.json(toDriver(db.prepare('SELECT * FROM drivers WHERE id=?').get(req.auth!.id)));});
router.put('/me/location',requireRole('driver'),(req,res)=>{const lat=Number(req.body?.lat),lng=Number(req.body?.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return res.status(400).json({error:'Valid coordinates are required.'});db.prepare("UPDATE drivers SET current_lat=?,current_lng=?,location_updated_at=datetime('now') WHERE id=?").run(lat,lng,req.auth!.id);res.json(toDriver(db.prepare('SELECT * FROM drivers WHERE id=?').get(req.auth!.id)));});
router.get('/live',requireRole('admin'),(_req,res)=>res.json(db.prepare("SELECT id,name,status,approval_status,current_lat,current_lng,location_updated_at,vehicle_type,vehicle_plate FROM drivers WHERE approval_status='Approved' ORDER BY name").all()));
export default router;
