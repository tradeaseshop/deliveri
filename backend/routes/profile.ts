import { Router } from 'express';
import db from '../db';
import { hashPassword, verifyPassword, requireRole } from '../auth';
import { toAdmin, toDriver } from '../serialize';

const router = Router();

function clean(value: unknown, max = 500): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

function validateImage(data: unknown): string | null {
  if (!data) return null;
  const s = String(data);
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return null;
  if (s.length > 2_500_000) return null;
  return s;
}

function validateDocument(data: unknown): string | null {
  if (!data) return null;
  const s = String(data);
  if (!/^(data:application\/pdf|data:image\/(jpeg|jpg|png|webp));base64,[A-Za-z0-9+/=]+$/.test(s)) return null;
  if (s.length > 6_500_000) return null;
  return s;
}

router.put('/me', requireRole('admin', 'driver'), (req, res) => {
  const body = req.body || {};
  const newPassword = body.newPassword ? String(body.newPassword) : '';
  if (newPassword && newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

  if (req.auth!.role === 'admin') {
    const row = db.prepare('SELECT * FROM admins WHERE id=?').get(req.auth!.id) as any;
    if (!row) return res.status(404).json({ error: 'Account not found' });
    if (newPassword && !body.currentPassword) return res.status(400).json({ error: 'Enter your current password before setting a new password.' });
    if (body.currentPassword && !verifyPassword(String(body.currentPassword), row.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
    const avatar = body.avatar !== undefined ? validateImage(body.avatar) : row.avatar;
    if (body.avatar !== undefined && body.avatar !== null && !avatar) return res.status(400).json({ error: 'Profile photo must be a JPG, PNG or WebP image under 2 MB.' });
    db.prepare(`UPDATE admins SET name=?, phone=?, office_location=?, address=?, avatar=?, ${newPassword ? 'password_hash=?,' : ''} updated_at=datetime('now') WHERE id=?`).run(
      clean(body.name,120) || row.name, clean(body.phone,40), clean(body.officeLocation,160), clean(body.address,250), avatar,
      ...(newPassword ? [hashPassword(newPassword)] : []), req.auth!.id
    );
    const updated = db.prepare('SELECT * FROM admins WHERE id=?').get(req.auth!.id) as any;
    return res.json({ admin: toAdmin(updated) });
  }

  const row = db.prepare('SELECT * FROM drivers WHERE id=?').get(req.auth!.id) as any;
  if (!row) return res.status(404).json({ error: 'Account not found' });
  if (newPassword && !body.currentPassword) return res.status(400).json({ error: 'Enter your current password before setting a new password.' });
  if (body.currentPassword && !verifyPassword(String(body.currentPassword), row.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  const avatar = body.avatar !== undefined ? validateImage(body.avatar) : row.avatar;
  if (body.avatar !== undefined && body.avatar !== null && !avatar) return res.status(400).json({ error: 'Profile photo must be a JPG, PNG or WebP image under 2 MB.' });
  const idDocument = body.idDocument !== undefined ? validateDocument(body.idDocument) : row.id_document;
  if (body.idDocument !== undefined && body.idDocument !== null && !idDocument) return res.status(400).json({ error: 'ID document must be a PDF or image under 5 MB.' });
  db.prepare(`UPDATE drivers SET name=?, phone=?, address=?, id_type=?, id_number=?, id_document=?, vehicle_type=?, vehicle_plate=?, vehicle_model=?, vehicle_color=?, vehicle_year=?, emergency_contact=?, avatar=?, ${newPassword ? 'password_hash=?,' : ''} updated_at=datetime('now') WHERE id=?`).run(
    clean(body.name,120) || row.name, clean(body.phone,40), clean(body.address,250), clean(body.idType,60), clean(body.idNumber,100), idDocument,
    clean(body.vehicleType,40) || row.vehicle_type, clean(body.vehiclePlate,40), clean(body.vehicleModel,100), clean(body.vehicleColor,60), body.vehicleYear ? Number(body.vehicleYear) : null, clean(body.emergencyContact,120), avatar,
    ...(newPassword ? [hashPassword(newPassword)] : []), req.auth!.id
  );
  const updated = db.prepare('SELECT * FROM drivers WHERE id=?').get(req.auth!.id) as any;
  res.json({ driver: toDriver(updated) });
});

export default router;
