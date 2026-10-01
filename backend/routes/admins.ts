import { Router } from 'express';
import db from '../db';
import { toAdmin } from '../serialize';
import { requireRole, requireAdminLevel, ADMIN_RANK } from '../auth';
import { runSeed } from '../seed';

const router = Router();

// GET /api/admins  (admin: full team roster — read-only, any admin level)
router.get('/', requireRole('admin'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM admins ORDER BY created_at DESC').all();
  res.json(rows.map(toAdmin));
});

// POST /api/admins/reset-demo — wipes and re-seeds the ENTIRE database with
// sample data. This used to be callable by any admin account, including the
// lowest-privilege one (or, until the admin/signup route was removed, by
// anyone who'd just self-registered). Now it requires Super Admin, and is
// additionally disabled unless ALLOW_DEMO_RESET=true is set in the
// environment — a real production deployment should leave that unset so
// this destructive demo-only action can't be triggered at all, by anyone.
router.post('/reset-demo', requireAdminLevel(ADMIN_RANK['Super Admin']), (_req, res) => {
  if (process.env.ALLOW_DEMO_RESET !== 'true') {
    return res.status(403).json({
      error: 'Demo data reset is disabled in this environment. Set ALLOW_DEMO_RESET=true to enable it (not recommended once real data exists).',
    });
  }
  try {
    runSeed();
    res.json({ success: true });
  } catch (e) {
    console.error('Error resetting demo data:', e);
    res.status(500).json({ error: 'Failed to reset demo data' });
  }
});

export default router;
