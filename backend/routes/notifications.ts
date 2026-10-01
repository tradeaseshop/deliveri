import { Router } from 'express';
import db from '../db';
import { toNotification } from '../serialize';
import { requireRole } from '../auth';

const router = Router();

// GET /api/notifications  (own notifications: driver by id, admin sees admin-broadcast + own)
router.get('/', requireRole('admin', 'driver'), (req, res) => {
  const rows =
    req.auth!.role === 'admin'
      ? db
          .prepare(
            `SELECT * FROM notifications WHERE recipient_type = 'admin' AND (recipient_id IS NULL OR recipient_id = ?) ORDER BY timestamp DESC`
          )
          .all(req.auth!.id)
      : db
          .prepare(`SELECT * FROM notifications WHERE recipient_type = 'driver' AND recipient_id = ? ORDER BY timestamp DESC`)
          .all(req.auth!.id);
  res.json(rows.map(toNotification));
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireRole('admin', 'driver'), (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
