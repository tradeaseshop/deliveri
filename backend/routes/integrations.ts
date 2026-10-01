import { Router } from 'express';
import { requireRole, requireAdminLevel, ADMIN_RANK } from '../auth';
import { getRecentTradeEaseEvents, getTradeEaseIntegrationStatus } from '../tradeEaseIntegration';
import { providerDescriptor } from '../provider';

const router = Router();

// Read-only provider metadata used by TradeEase's multi-carrier integration
// layer. No secrets or operational data are exposed here.
router.get('/provider', (_req, res) => {
  res.json(providerDescriptor());
});

// Operational visibility for DELIVERI admins. No secrets are returned.
router.get('/tradeease', requireRole('admin'), (_req, res) => {
  res.json(getTradeEaseIntegrationStatus());
});

router.get('/tradeease/events', requireAdminLevel(ADMIN_RANK.Manager), (req, res) => {
  const rawLimit = Number(req.query.limit || 50);
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50));
  res.json(getRecentTradeEaseEvents(limit));
});

export default router;
