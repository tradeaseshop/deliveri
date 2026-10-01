import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../db';
import { hashPassword, verifyPassword, signToken, requireRole, requireAdminLevel, ADMIN_RANK } from '../auth';
import { toAdmin, toDriver } from '../serialize';
import { insertWithUniqueId } from '../ids';
import crypto from 'crypto';

const router = Router();

// POST /api/auth/driver/signup  { name, email, phone, password, vehicleType, vehiclePlate }
router.post('/driver/signup', (req, res) => {
  const { name, email, phone, password, vehicleType, vehiclePlate } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM drivers WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ error: 'A driver account with this email already exists' });

  const { id } = insertWithUniqueId('DRV', (id) =>
    db
      .prepare(
        `INSERT INTO drivers (id, name, phone, email, password_hash, vehicle_type, vehicle_plate, status, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Offline', 'Pending')`
      )
      .run(id, name, phone || null, cleanEmail, hashPassword(password), vehicleType || 'Motorcycle', vehiclePlate || null)
  );

  // New drivers await admin approval before they can go online, mirroring the original app's flow.
  db.prepare(
    `INSERT INTO notifications (id, recipient_type, recipient_id, title, body, type) VALUES (?, 'admin', NULL, ?, ?, 'system')`
  ).run(randomUUID(), 'New Driver Signup', `${name} has applied to join as a courier and is awaiting approval.`);

  const row = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id) as any;
  const token = signToken({ id: row.id, email: row.email, role: 'driver' });
  res.status(201).json({ token, driver: toDriver(row) });
});

// POST /api/auth/driver/login  { email, password }
router.post('/driver/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const row = db.prepare('SELECT * FROM drivers WHERE email = ?').get(String(email).trim().toLowerCase()) as any;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (row.approval_status === 'Suspended') {
    return res.status(403).json({ error: 'This driver account has been suspended.' });
  }
  const token = signToken({ id: row.id, email: row.email, role: 'driver' });
  res.json({ token, driver: toDriver(row) });
});

// POST /api/auth/admin/login  { email, password }
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const row = db.prepare('SELECT * FROM admins WHERE email = ?').get(String(email).trim().toLowerCase()) as any;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken({ id: row.id, email: row.email, role: 'admin' });
  res.json({ token, admin: toAdmin(row) });
});

// There used to be a POST /api/auth/admin/signup here: a public,
// unauthenticated route that let anyone create a full admin account with no
// invite or approval step, and it was wired up in the frontend's "Apply to
// Fleet" screen. That was a straightforward auth bypass — removed entirely.
// Admin accounts are now only ever created by an existing Manager-or-above
// admin via POST /admin below, the same invite-only shape TradeEase uses.

// POST /api/auth/admin  { name, email, password?, role, officeLocation }
// An existing Manager or Super Admin adds a new admin. If no password is
// supplied (the admin dashboard's "add admin" form doesn't collect one), a
// default is used and should be changed on first login.
router.post('/admin', requireAdminLevel(ADMIN_RANK.Manager), (req, res) => {
  const { name, email, password, role, officeLocation } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  const cleanEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ error: 'An admin account with this email already exists' });

  const { id } = insertWithUniqueId('ADM', (id) =>
    db
      .prepare(
        `INSERT INTO admins (id, name, email, password_hash, role, office_location, status) VALUES (?, ?, ?, ?, ?, ?, 'Active')`
      )
      .run(id, name, cleanEmail, hashPassword(password || 'welcome123'), role || 'Office Assistant', officeLocation || null)
  );

  res.status(201).json(toAdmin(db.prepare('SELECT * FROM admins WHERE id = ?').get(id)));
});

// GET /api/auth/me
// Switch workspace without logging out. A dual-workspace identity is represented by the same email
// existing in both account tables. The target account is re-checked server-side before a new token is issued.
router.post('/switch-role', requireRole('admin', 'driver'), (req, res) => {
  const target = String(req.body?.role || '').toLowerCase();
  if (target !== 'admin' && target !== 'driver') return res.status(400).json({ error: 'role must be admin or driver' });
  const email = req.auth!.email.toLowerCase();
  if (target === req.auth!.role) return res.json({ token: signToken({ id: req.auth!.id, email, role: req.auth!.role }), role: req.auth!.role });
  if (target === 'admin') {
    const row = db.prepare("SELECT * FROM admins WHERE email = ? AND status = 'Active'").get(email) as any;
    if (!row) return res.status(403).json({ error: 'This account is not enabled for Admin workspace' });
    return res.json({ token: signToken({ id: row.id, email: row.email, role: 'admin' }), role: 'admin', admin: toAdmin(row) });
  }
  const row = db.prepare("SELECT * FROM drivers WHERE email = ? AND approval_status != 'Suspended'").get(email) as any;
  if (!row) return res.status(403).json({ error: 'This account is not enabled for Driver workspace' });
  return res.json({ token: signToken({ id: row.id, email: row.email, role: 'driver' }), role: 'driver', driver: toDriver(row) });
});

router.post('/password/request', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });
  const admin = db.prepare('SELECT id,name,email FROM admins WHERE email=?').get(email) as any;
  const driver = db.prepare('SELECT id,name,email FROM drivers WHERE email=?').get(email) as any;
  const account = admin ? { type: 'admin' as const, ...admin } : driver ? { type: 'driver' as const, ...driver } : null;
  // Do not disclose whether an email exists.
  if (!account) return res.json({ message: 'If an account exists, a password reset link will be sent.' });
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  db.prepare("DELETE FROM password_resets WHERE account_id=? OR expires_at <= datetime('now')").run(account.id);
  db.prepare("INSERT INTO password_resets(id,account_type,account_id,token_hash,expires_at) VALUES(?,?,?,?,datetime('now','+30 minutes'))").run(crypto.randomUUID(), account.type, account.id, hash);
  const base = process.env.APP_BASE_URL || '';
  const link = `${base.replace(/\/$/, '')}/reset-password?token=${raw}`;
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    await fetch('https://api.resend.com/emails', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.RESEND_API_KEY}`}, body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[account.email],subject:'DELIVERI password reset',html:`<p>Hello ${account.name},</p><p>Use this link to reset your DELIVERI password. It expires in 30 minutes.</p><p><a href="${link}">${link}</a></p>`}) }).catch(e=>console.error('[password-reset] email failed',e));
  } else if (process.env.NODE_ENV !== 'production') {
    console.log(`[password-reset] DEV reset link for ${account.email}: ${link}`);
    return res.json({ message: 'If an account exists, a password reset link will be sent.', developmentResetToken: raw });
  }
  res.json({ message: 'If an account exists, a password reset link will be sent.' });
});

router.post('/password/reset', (req, res) => {
  const token = String(req.body?.token || ''); const password = String(req.body?.password || '');
  if (token.length < 32 || password.length < 8) return res.status(400).json({ error: 'A valid token and password of at least 8 characters are required' });
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const reset = db.prepare("SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now')").get(hash) as any;
  if (!reset) return res.status(400).json({ error: 'Reset token is invalid or expired' });
  const table = reset.account_type === 'admin' ? 'admins' : 'drivers';
  db.prepare(`UPDATE ${table} SET password_hash=? WHERE id=?`).run(hashPassword(password), reset.account_id);
  db.prepare("UPDATE password_resets SET used_at=datetime('now') WHERE id=?").run(reset.id);
  res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
});

router.get('/me', requireRole('admin', 'driver'), (req, res) => {
  if (req.auth!.role === 'admin') {
    const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.auth!.id) as any;
    if (!row) return res.status(404).json({ error: 'Not found' });
    const driver = db.prepare('SELECT id,approval_status FROM drivers WHERE email=?').get(row.email) as any; return res.json({ role: 'admin', admin: toAdmin(row), availableRoles: driver && driver.approval_status !== 'Suspended' ? ['admin','driver'] : ['admin'] });
  }
  const row = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.auth!.id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  const admin = db.prepare("SELECT id,status FROM admins WHERE email=? AND status='Active'").get(row.email) as any; res.json({ role: 'driver', driver: toDriver(row), availableRoles: admin ? ['driver','admin'] : ['driver'] });
});

export default router;
