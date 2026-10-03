import { Router } from 'express';
import db from '../db';
import { toEarning } from '../serialize';
import { requireRole } from '../auth';

const router = Router();

// GET /api/earnings  (driver: own records; admin: all, or ?driverId= to filter)
router.get('/', requireRole('admin', 'driver'), (req, res) => {
  if (req.auth!.role === 'driver') {
    const rows = db.prepare('SELECT * FROM earnings WHERE driver_id = ? ORDER BY date DESC').all(req.auth!.id);
    return res.json(rows.map(toEarning));
  }
  const { driverId } = req.query as Record<string, string | undefined>;
  const rows = driverId
    ? db.prepare('SELECT * FROM earnings WHERE driver_id = ? ORDER BY date DESC').all(driverId)
    : db.prepare('SELECT * FROM earnings ORDER BY date DESC').all();
  res.json(rows.map(toEarning));
});

export default router;
