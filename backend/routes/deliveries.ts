import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../db';
import { toDelivery } from '../serialize';
import { requireRole } from '../auth';
import { enqueueTradeEaseEvent, getDeliveryEventType } from '../tradeEaseIntegration';

const router = Router();

function loadDelivery(id: string) {
  const row = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id);
  return row ? toDelivery(row) : null;
}

function audit(action:string, entityType:string, entityId:string, actorType:string, actorId:string|null, metadata:any={}) { db.prepare(`INSERT INTO audit_logs(id,actor_type,actor_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).run(randomUUID(),actorType,actorId,action,entityType,entityId,JSON.stringify(metadata)); }

function addNotification(recipientType: 'admin' | 'driver', recipientId: string | null, title: string, body: string, type: string) {
  db.prepare(
    `INSERT INTO notifications (id, recipient_type, recipient_id, title, body, type) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), recipientType, recipientId, title, body, type);
}

// GET /api/deliveries?unassigned=1&driverId=  (admin: everything, or filtered; driver: own + open pool)
router.get('/', requireRole('admin', 'driver'), (req, res) => {
  const { unassigned, driverId } = req.query as Record<string, string | undefined>;
  let rows: any[];
  if (req.auth!.role === 'driver') {
    rows = db
      .prepare(`SELECT * FROM deliveries WHERE assigned_driver_id = ? OR assigned_driver_id IS NULL ORDER BY created_at DESC`)
      .all(req.auth!.id);
  } else if (unassigned) {
    rows = db.prepare('SELECT * FROM deliveries WHERE assigned_driver_id IS NULL ORDER BY created_at DESC').all();
  } else if (driverId) {
    rows = db.prepare('SELECT * FROM deliveries WHERE assigned_driver_id = ? ORDER BY created_at DESC').all(driverId);
  } else {
    rows = db.prepare('SELECT * FROM deliveries ORDER BY created_at DESC').all();
  }
  res.json(rows.map(toDelivery));
});

// Public tracking exposes only the minimum operational information needed to follow a shipment.
// Customer phone, exact addresses, QR token, driver coordinates and package value are never public.
router.get('/track/:trackingNumber', (req, res) => {
  const row = db.prepare(`SELECT id,tracking_number,status,created_at,picked_up_at,transit_at,delivered_at,rejected_reason,source_platform,source_order_id,source_order_number FROM deliveries WHERE tracking_number = ?`).get(req.params.trackingNumber) as any;
  if (!row) return res.status(404).json({ error: 'No delivery found for this tracking number' });
  const labels: Record<string,string> = { Assigned:'Awaiting courier', 'Picked Up':'Picked up', 'In Transit':'In transit', Delivered:'Delivered', Rejected:'Awaiting reassignment' };
  res.json({ trackingNumber: row.tracking_number, status: row.status, statusLabel: labels[row.status] || row.status, createdAt: row.created_at, pickedUpAt: row.picked_up_at, transitAt: row.transit_at, deliveredAt: row.delivered_at, rejected: row.status === 'Rejected', sourcePlatform: row.source_platform || null, orderNumber: row.source_order_number || row.source_order_id || null });
});

// POST /api/deliveries  (admin manually creates a delivery, same as the in-app "New Dispatch" form)
router.post('/', requireRole('admin'), (req, res) => {
  const b = req.body || {};
  if (!b.dropoffAddress || !b.customerName) {
    return res.status(400).json({ error: 'dropoffAddress and customerName are required' });
  }
  const id = `DEL-${Date.now()}`;
  const trackingNumber = `TE-SE-${10000 + Math.floor(Math.random() * 90000)}`;
  const qrCodeToken = `QR-${trackingNumber}`;

  db.prepare(
    `INSERT INTO deliveries
      (id, tracking_number, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
       customer_name, customer_phone, seller_name, package_name, package_weight, package_value, delivery_fee,
       payment_method, payment_status, status, assigned_driver_id, assigned_driver_name, qr_code_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?)`
  ).run(
    id, trackingNumber, b.pickupAddress || null, b.pickupLat || null, b.pickupLng || null,
    b.dropoffAddress, b.dropoffLat || null, b.dropoffLng || null,
    b.customerName, b.customerPhone || null, b.sellerName || null, b.packageName || null,
    b.packageWeight || 0, b.packageValue || 0, b.deliveryFee || 0,
    b.paymentMethod || 'Cash on Delivery', b.paymentStatus || 'Pending',
    b.assignedDriverId || null, b.assignedDriverName || null, qrCodeToken
  );

  if (b.assignedDriverId) {
    addNotification('driver', b.assignedDriverId, 'New Dispatch Assigned', `Shipment ${trackingNumber} has been dispatched to you.`, 'delivery');
  } else {
    addNotification('admin', null, 'New Delivery Awaiting Assignment', `Delivery ${trackingNumber} needs a courier.`, 'delivery');
  }

  res.status(201).json(loadDelivery(id));
});

// PUT /api/deliveries/:id/assign  { driverId }  (admin manual assignment)
router.put('/:id/assign', requireRole('admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Delivery not found' });
  const { driverId } = req.body || {};

  let driverName: string | null = null;
  if (driverId) {
    const driver = db.prepare('SELECT name FROM drivers WHERE id = ?').get(driverId) as any;
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    driverName = driver.name;
  }

  db.prepare(`UPDATE deliveries SET assigned_driver_id = ?, assigned_driver_name = ?, status = 'Assigned' WHERE id = ?`).run(
    driverId || null, driverName, req.params.id
  );

  if (driverId) {
    audit('delivery.assigned','delivery',req.params.id,'admin',req.auth!.id,{driverId});
    addNotification('driver', driverId, 'Manual Order Assignment', `Office team assigned delivery ${existing.tracking_number} to you.`, 'delivery');
    const assigned = loadDelivery(req.params.id);
    if (assigned?.sourcePlatform === 'TradeEase') enqueueTradeEaseEvent(assigned.id, 'delivery.assigned');
  }

  res.json(loadDelivery(req.params.id));
});

// PUT /api/deliveries/:id/accept  (driver accepts an open/assigned delivery)
router.put('/:id/accept', requireRole('driver'), (req, res) => {
  const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Delivery not found' });
  const driver = db.prepare('SELECT name, approval_status, status FROM drivers WHERE id = ?').get(req.auth!.id) as any;
  if (!driver) return res.status(404).json({ error: 'Driver account not found' });
  if (driver.approval_status !== 'Approved') return res.status(403).json({ error: 'Your driver account is not approved' });
  if (driver.status !== 'Online') return res.status(403).json({ error: 'Go online before accepting a delivery' });
  if (existing.assigned_driver_id && existing.assigned_driver_id !== req.auth!.id) {
    return res.status(409).json({ error: 'This delivery is already assigned to another driver' });
  }
  if (!['Assigned', 'Rejected'].includes(existing.status)) {
    return res.status(409).json({ error: `Delivery cannot be accepted while it is ${existing.status}` });
  }

  db.prepare(
    `UPDATE deliveries SET assigned_driver_id = ?, assigned_driver_name = ?, accepted_at = datetime('now'), status = 'Assigned' WHERE id = ?`
  ).run(req.auth!.id, driver?.name || null, req.params.id);

  const updated = loadDelivery(req.params.id)!;
  audit('delivery.accepted','delivery',updated.id,'driver',req.auth!.id);
  enqueueTradeEaseEvent(updated.id, 'delivery.accepted');
  res.json(updated);
});

// PUT /api/deliveries/:id/reject  { reason }  (driver rejects, returns to open pool)
router.put('/:id/reject', requireRole('driver'), (req, res) => {
  const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Delivery not found' });
  const { reason } = req.body || {};
  if (existing.assigned_driver_id && existing.assigned_driver_id !== req.auth!.id) {
    return res.status(403).json({ error: 'You can only reject a delivery assigned to you' });
  }
  if (!['Assigned', 'Rejected'].includes(existing.status)) {
    return res.status(409).json({ error: `Delivery cannot be rejected while it is ${existing.status}` });
  }

  db.prepare(
    `UPDATE deliveries SET assigned_driver_id = NULL, assigned_driver_name = NULL, status = 'Rejected', rejected_reason = ? WHERE id = ?`
  ).run(reason || 'No reason given', req.params.id);

  addNotification('admin', null, 'Carrier Shipment Rejection', `Delivery ${existing.tracking_number} rejected: "${reason || 'No reason given'}". Returning to open pool.`, 'system');

  audit('delivery.rejected','delivery',req.params.id,'driver',req.auth!.id,{reason:reason||'No reason given'});
  const updated = loadDelivery(req.params.id)!;
  const eventType = getDeliveryEventType(updated.status);
  if (eventType) enqueueTradeEaseEvent(updated.id, eventType);
  res.json(updated);
});

// PUT /api/deliveries/:id/status  { status: 'Picked Up' | 'In Transit' | 'Delivered' }  (driver progresses a delivery)
router.put('/:id/status', requireRole('driver', 'admin'), (req, res) => {
  const { status } = req.body || {};
  const allowed = ['Picked Up', 'In Transit', 'Delivered'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });

  const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Delivery not found' });
  if (req.auth!.role === 'driver' && existing.assigned_driver_id !== req.auth!.id) {
    return res.status(403).json({ error: 'You can only update a delivery assigned to you' });
  }

  let changed = false;
  try {
    changed = applyStatusChange(existing, status);
  } catch (error: any) {
    return res.status(error?.statusCode || 409).json({ error: error?.message || 'Invalid delivery status transition' });
  }
  const updated = loadDelivery(req.params.id)!;
  if (changed) {
    audit(`delivery.status.${updated.status.toLowerCase().replace(/\s+/g,'_')}`,'delivery',updated.id,req.auth!.role,req.auth!.id);
    const eventType = getDeliveryEventType(updated.status);
    if (eventType) enqueueTradeEaseEvent(updated.id, eventType);
  }
  res.json(updated);
});

// POST /api/deliveries/:id/confirm-qr  { qrCodeToken }  (driver confirms drop-off via QR scan -> Delivered)
router.post('/:id/confirm-qr', requireRole('driver'), (req, res) => {
  const { qrCodeToken } = req.body || {};
  const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Delivery not found' });
  if (existing.assigned_driver_id !== req.auth!.id) {
    return res.status(403).json({ error: 'You can only confirm delivery for a shipment assigned to you' });
  }
  if (existing.qr_code_token !== qrCodeToken) {
    return res.status(400).json({ error: 'QR code does not match this delivery. Scan the code on the customer\u2019s package.' });
  }

  let changed = false;
  try {
    changed = applyStatusChange(existing, 'Delivered');
  } catch (error: any) {
    return res.status(error?.statusCode || 409).json({ error: error?.message || 'Invalid delivery status transition' });
  }
  const updated = loadDelivery(req.params.id)!;
  if (changed) enqueueTradeEaseEvent(updated.id, 'delivery.delivered');
  res.json(updated);
});

// Shared status-transition logic: timestamps, driver stat bumps, and an
// earnings record on delivery — mirrors the original app's local-state logic.
function applyStatusChange(existing: any, status: 'Picked Up' | 'In Transit' | 'Delivered') {
  const transitions: Record<string, string[]> = {
    Assigned: ['Picked Up'], Rejected: ['Picked Up'], 'Picked Up': ['In Transit'], 'In Transit': ['Delivered'], Delivered: [],
  };
  if (!transitions[existing.status]?.includes(status)) {
    const error = new Error(`Invalid delivery transition: ${existing.status} -> ${status}`); (error as any).statusCode = 409; throw error;
  }
  if (!existing.assigned_driver_id) { const error = new Error('A driver must be assigned before the delivery can progress'); (error as any).statusCode=409; throw error; }
  if (status === 'Picked Up' && !existing.accepted_at) { const error = new Error('Driver must accept the delivery before pickup'); (error as any).statusCode=409; throw error; }
  const timestampColumn = status === 'Picked Up' ? 'picked_up_at' : status === 'In Transit' ? 'transit_at' : 'delivered_at';
  db.prepare(`UPDATE deliveries SET status = ?, ${timestampColumn} = datetime('now') WHERE id = ?`).run(status, existing.id);
  if (status === 'Delivered') {
    const fee = Math.max(0, Number(existing.delivery_fee || 0));
    const pct = Math.min(100, Math.max(0, Number(process.env.DELIVERI_DRIVER_COMMISSION_PERCENT || 70)));
    const driverEarning = Math.round(fee * pct) / 100;
    const platformRevenue = Math.round((fee - driverEarning) * 100) / 100;
    db.prepare(`UPDATE drivers SET total_deliveries = total_deliveries + 1, earnings = earnings + ?, current_lat = COALESCE(?,current_lat), current_lng = COALESCE(?,current_lng) WHERE id = ?`).run(driverEarning, existing.dropoff_lat, existing.dropoff_lng, existing.assigned_driver_id);
    db.prepare(`INSERT INTO earnings (id,delivery_id,driver_id,amount,gross_delivery_fee,driver_commission,platform_revenue,payout_status) VALUES (?,?,?,?,?,?,?,'Pending')`).run(randomUUID(), existing.id, existing.assigned_driver_id, driverEarning, fee, pct, platformRevenue);
    db.prepare(`INSERT OR IGNORE INTO revenue_ledger (id,delivery_id,source_order_id,entry_type,amount,description) VALUES (?,?,?,?,?,?)`).run(randomUUID(),existing.id,existing.source_order_id,'delivery_fee',fee,'Delivery fee received');
    db.prepare(`INSERT OR IGNORE INTO revenue_ledger (id,delivery_id,source_order_id,entry_type,amount,description) VALUES (?,?,?,?,?,?)`).run(randomUUID(),existing.id,existing.source_order_id,'driver_commission',driverEarning,'Driver commission');
    db.prepare(`INSERT OR IGNORE INTO revenue_ledger (id,delivery_id,source_order_id,entry_type,amount,description) VALUES (?,?,?,?,?,?)`).run(randomUUID(),existing.id,existing.source_order_id,'platform_revenue',platformRevenue,'DELIVERI platform revenue');
    db.prepare(`INSERT INTO reconciliation_records (id,delivery_id,source_order_id,source_fulfillment_id,tradeease_amount,deliveri_delivery_fee,driver_earning,platform_revenue,status) VALUES (?,?,?,?,?,?,?,?,?)`).run(randomUUID(),existing.id,existing.source_order_id,existing.source_fulfillment_id,null,fee,driverEarning,platformRevenue,'Pending');
    addNotification('driver', existing.assigned_driver_id, 'Shipment Successfully Delivered!', `Package ${existing.tracking_number} finalized. Driver earning: ₦${driverEarning.toLocaleString()}.`, 'payout');
  }
  return true;
}

// Admin-only live delivery feed with driver coordinates for the dispatch map.
router.get('/live', requireRole('admin'), (_req,res) => {
  const rows=db.prepare(`SELECT d.id,d.tracking_number,d.status,d.assigned_driver_id,d.assigned_driver_name,d.dropoff_lat,d.dropoff_lng,r.current_lat,r.current_lng,r.location_updated_at FROM deliveries d LEFT JOIN drivers r ON r.id=d.assigned_driver_id WHERE d.status IN ('Assigned','Picked Up','In Transit','Rejected') ORDER BY d.created_at DESC`).all();
  res.json(rows);
});

export default router;
