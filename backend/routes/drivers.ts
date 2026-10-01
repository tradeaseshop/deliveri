import { Router } from 'express';
import db from '../db';
import { toDriver } from '../serialize';
import { hashPassword, requireRole, requireAdminLevel, ADMIN_RANK } from '../auth';
import { insertWithUniqueId } from '../ids';

const router = Router();

// GET /api/drivers  (admin: full roster — read-only, any admin level)
router.get('/', requireRole('admin'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM drivers ORDER BY created_at DESC').all();
  res.json(rows.map(toDriver));
});

// POST /api/drivers  (Dispatcher+ manually onboards a driver, approved immediately —
// unlike public driver signup, which starts as Pending). The admin form
// doesn't collect a password, so a default is set and should be changed by
// the driver on first login.
router.post('/', requireAdminLevel(ADMIN_RANK.Dispatcher), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.phone || !b.vehiclePlate) {
    return res.status(400).json({ error: 'name, phone and vehiclePlate are required' });
  }
  const cleanEmail = (b.email || `${b.name.toLowerCase().replace(/\s+/g, '')}@deliveri.ng`).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM drivers WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ error: 'A driver account with this email already exists' });

  const { id } = insertWithUniqueId('DRV', (id) =>
    db
      .prepare(
        `INSERT INTO drivers
          (id, name, phone, email, password_hash, vehicle_type, vehicle_plate, status, approval_status, current_lat, current_lng, avatar)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Offline', 'Approved', ?, ?, ?)`
      )
      .run(
        id, b.name, b.phone, cleanEmail, hashPassword('welcome123'), b.vehicleType || 'Motorcycle', b.vehiclePlate,
        b.currentLat ?? 6.4584, b.currentLng ?? 7.5083, b.avatar || null
      )
  );

  res.status(201).json(toDriver(db.prepare('SELECT * FROM drivers WHERE id = ?').get(id)));
});

// PUT /api/drivers/:id/approve  (Dispatcher+)
router.put('/:id/approve', requireAdminLevel(ADMIN_RANK.Dispatcher), (req, res) => {
  const existing = db.prepare('SELECT id FROM drivers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Driver not found' });
  db.prepare(`UPDATE drivers SET approval_status = 'Approved' WHERE id = ?`).run(req.params.id);
  res.json(toDriver(db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id)));
});

// PUT /api/drivers/:id/suspend  (Dispatcher+)
router.put('/:id/suspend', requireAdminLevel(ADMIN_RANK.Dispatcher), (req, res) => {
  const existing = db.prepare('SELECT id FROM drivers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Driver not found' });
  db.prepare(`UPDATE drivers SET approval_status = 'Suspended', status = 'Offline' WHERE id = ?`).run(req.params.id);
  res.json(toDriver(db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id)));
});

// PUT /api/drivers/me/status  { online: boolean }  (driver self-toggle)
router.put('/me/status', requireRole('driver'), (req, res) => {
  const { online } = req.body || {};
  const driver = db.prepare('SELECT approval_status FROM drivers WHERE id = ?').get(req.auth!.id) as any;
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  if (online && driver.approval_status !== 'Approved') {
    return res.status(403).json({ error: 'Your driver account must be approved before going online' });
  }
  db.prepare(`UPDATE drivers SET status = ? WHERE id = ?`).run(online ? 'Online' : 'Offline', req.auth!.id);
  res.json(toDriver(db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.auth!.id)));
});

// PUT /api/drivers/me/location  { lat, lng }  (driver self-reports GPS position)
router.put('/me/location', requireRole('driver'), (req, res) => {
  const { lat, lng } = req.body || {};
  const nlat=Number(lat), nlng=Number(lng);
  if (!Number.isFinite(nlat) || !Number.isFinite(nlng) || nlat < -90 || nlat > 90 || nlng < -180 || nlng > 180) return res.status(400).json({ error: 'valid lat and lng are required' });
  db.prepare(`UPDATE drivers SET current_lat = ?, current_lng = ?, location_updated_at = datetime('now') WHERE id = ?`).run(nlat, nlng, req.auth!.id);
  res.json(toDriver(db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.auth!.id)));
});

// Live fleet feed for the dispatch map. Only admin users receive exact driver coordinates.
router.get('/live', requireRole('admin'), (_req, res) => {
  const rows = db.prepare(`SELECT id,name,status,approval_status,current_lat,current_lng,location_updated_at,vehicle_type,vehicle_plate FROM drivers WHERE approval_status='Approved' ORDER BY name`).all();
  res.json(rows);
});

export default router;
