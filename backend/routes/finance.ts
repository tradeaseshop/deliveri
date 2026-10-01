import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../db';
import { requireRole, requireAdminLevel, ADMIN_RANK } from '../auth';

const router = Router();

router.get('/summary', requireRole('admin'), (_req,res)=>{
  const r:any=db.prepare(`SELECT COALESCE(SUM(amount),0) totalDriverEarnings, COALESCE(SUM(platform_revenue),0) platformRevenue, COALESCE(SUM(gross_delivery_fee),0) grossFees FROM earnings`).get();
  const p:any=db.prepare(`SELECT COALESCE(SUM(amount),0) pending FROM earnings WHERE payout_status!='Paid'`).get();
  res.json({grossFees:Number(r.grossFees||0),driverEarnings:Number(r.totalDriverEarnings||0),platformRevenue:Number(r.platformRevenue||0),pendingPayouts:Number(p.pending||0)});
});

router.get('/payouts', requireRole('admin','driver'), (req,res)=>{
  const rows=req.auth!.role==='driver'
    ? db.prepare(`SELECT * FROM driver_payouts WHERE driver_id=? ORDER BY requested_at DESC`).all(req.auth!.id)
    : db.prepare(`SELECT p.*,d.name driverName,d.email driverEmail FROM driver_payouts p JOIN drivers d ON d.id=p.driver_id ORDER BY p.requested_at DESC`).all();
  res.json(rows);
});

router.post('/payouts/request', requireRole('driver'), (req,res)=>{
  const amount=Number(req.body?.amount); if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:'amount must be greater than zero'});
  const available:any=db.prepare(`SELECT COALESCE(SUM(amount),0) available FROM earnings WHERE driver_id=? AND payout_status='Pending'`).get(req.auth!.id);
  if(amount>Number(available.available||0)) return res.status(409).json({error:'Requested payout exceeds available driver earnings'});
  const id=`PAY-${randomUUID()}`;
  db.transaction(()=>{
    const earnings=db.prepare(`SELECT id,amount FROM earnings WHERE driver_id=? AND payout_status='Pending' ORDER BY date ASC`).all(req.auth!.id) as any[];
    let remaining=amount;
    for(const e of earnings){ if(remaining<=0) break; db.prepare(`UPDATE earnings SET payout_status='In Process',payout_reference=? WHERE id=?`).run(id,e.id); remaining-=Number(e.amount); }
    db.prepare(`INSERT INTO driver_payouts(id,driver_id,amount,status,reference) VALUES(?,?,?,'Pending',?)`).run(id,req.auth!.id,amount,id);
  })();
  res.status(201).json(db.prepare('SELECT * FROM driver_payouts WHERE id=?').get(id));
});

router.put('/payouts/:id/status', requireAdminLevel(ADMIN_RANK.Manager), (req,res)=>{
  const status=String(req.body?.status||''); if(!['Processing','Paid','Failed'].includes(status)) return res.status(400).json({error:'status must be Processing, Paid or Failed'});
  const p:any=db.prepare('SELECT * FROM driver_payouts WHERE id=?').get(req.params.id); if(!p) return res.status(404).json({error:'Payout not found'});
  db.transaction(()=>{
    db.prepare(`UPDATE driver_payouts SET status=?,processed_at=CASE WHEN ? IN ('Paid','Failed') THEN datetime('now') ELSE processed_at END,processed_by=? WHERE id=?`).run(status,status,req.auth!.id,p.id);
    if(status==='Paid') db.prepare(`UPDATE earnings SET payout_status='Paid' WHERE payout_reference=?`).run(p.reference);
    if(status==='Failed') db.prepare(`UPDATE earnings SET payout_status='Pending',payout_reference=NULL WHERE payout_reference=?`).run(p.reference);
  })();
  res.json(db.prepare('SELECT * FROM driver_payouts WHERE id=?').get(p.id));
});

router.get('/reconciliation', requireAdminLevel(ADMIN_RANK.Manager), (_req,res)=>{
  res.json(db.prepare(`SELECT * FROM reconciliation_records ORDER BY created_at DESC LIMIT 200`).all());
});

router.get('/audit', requireAdminLevel(ADMIN_RANK.Manager), (req,res)=>{
  const limit=Math.min(200,Math.max(1,Number(req.query.limit||50)));
  res.json(db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?`).all(limit));
});

export default router;
