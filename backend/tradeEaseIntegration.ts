import 'dotenv/config';
import crypto from 'crypto';
import db from './db';
import { signPayload } from './webhookSignature';
import { toDelivery } from './serialize';
import { DELIVERI_PROVIDER } from './provider';

export const INTEGRATION_VERSION = DELIVERI_PROVIDER.integrationVersion;
const PROVIDER = 'TradeEase';

export type DeliveryEventType =
  | 'delivery.created'
  | 'delivery.accepted'
  | 'delivery.assigned'
  | 'delivery.picked_up'
  | 'delivery.in_transit'
  | 'delivery.delivered'
  | 'delivery.rejected';

const STATUS_MAP: Record<string, { carrierStatus: string; orderStatus: string }> = {
  Assigned: { carrierStatus: 'Dispatch Order Generated - Awaiting Courier Pickup', orderStatus: 'Processing' },
  Accepted: { carrierStatus: 'Courier Accepted Assignment', orderStatus: 'Processing' },
  'Picked Up': { carrierStatus: 'Package Picked Up by DELIVERI Courier', orderStatus: 'Processing' },
  'In Transit': { carrierStatus: 'In Transit to Destination', orderStatus: 'Shipped' },
  Delivered: { carrierStatus: 'Delivered and Confirmed via QR Scan', orderStatus: 'Delivered' },
  Rejected: { carrierStatus: 'Courier Rejected Pickup - Reassigning', orderStatus: 'Processing' },
};

function getOutboundUrl() {
  return process.env.TRADEEASE_WEBHOOK_URL || '';
}

function getOutboundSecret() {
  // TRADEEASE_WEBHOOK_SECRET is retained for compatibility with v2.2.
  return process.env.DELIVERI_TO_TRADEEASE_SECRET || process.env.TRADEEASE_WEBHOOK_SECRET || '';
}

function makeEventId(prefix = 'evt') {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function getDeliveryEventType(status: string): DeliveryEventType | null {
  const map: Record<string, DeliveryEventType> = {
    Assigned: 'delivery.assigned',
    // Acceptance is represented by accepted_at while status remains Assigned for backwards compatibility.
    // The accept endpoint explicitly enqueues this event, so this map is used for status changes only.

    'Picked Up': 'delivery.picked_up',
    'In Transit': 'delivery.in_transit',
    Delivered: 'delivery.delivered',
    Rejected: 'delivery.rejected',
  };
  return map[status] || null;
}

export function enqueueTradeEaseEvent(deliveryId: string, eventType: DeliveryEventType, eventId = makeEventId()) {
  const row = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId) as any;
  if (!row || row.source_platform !== PROVIDER || !row.source_order_id) return null;

  const mapping = eventType === 'delivery.accepted' ? STATUS_MAP.Accepted : (STATUS_MAP[row.status] || { carrierStatus: row.status, orderStatus: 'Processing' });
  const delivery = toDelivery(row);
  const occurredAt = new Date().toISOString();
  const payload = {
    specVersion: INTEGRATION_VERSION,
    eventId,
    eventType,
    source: 'DELIVERI',
    provider: {
      code: DELIVERI_PROVIDER.code,
      name: DELIVERI_PROVIDER.name,
      owner: DELIVERI_PROVIDER.owner,
      relationship: DELIVERI_PROVIDER.relationship,
      networkRole: DELIVERI_PROVIDER.networkRole,
    },
    occurredAt,
    // Legacy-compatible top-level fields are intentionally retained so the
    // existing TradeEase webhook receiver can consume v1 events while the
    // nested data contract is introduced.
    event: eventType,
    orderId: row.source_order_id,
    orderNumber: row.source_order_number || null,
    fulfillmentId: row.source_fulfillment_id || row.source_vendor_order_id || row.source_order_id,
    vendorId: row.source_vendor_id || null,
    vendorOrderId: row.source_vendor_order_id || null,
    trackingNumber: row.tracking_number,
    deliveryId: row.id,
    status: row.status,
    carrierStatus: mapping.carrierStatus,
    orderStatus: mapping.orderStatus,
    driverName: row.assigned_driver_name || null,
    rejectedReason: row.rejected_reason || null,
    pickedUpAt: row.picked_up_at || null,
    transitAt: row.transit_at || null,
    deliveredAt: row.delivered_at || null,
    acceptedAt: row.accepted_at || null,
    deliveryFee: Number(row.delivery_fee || 0),
    data: {
      providerCode: DELIVERI_PROVIDER.code,
      providerName: DELIVERI_PROVIDER.name,
      orderId: row.source_order_id,
      orderNumber: row.source_order_number || null,
      fulfillmentId: row.source_fulfillment_id || row.source_vendor_order_id || row.source_order_id,
      vendorId: row.source_vendor_id || null,
      vendorOrderId: row.source_vendor_order_id || null,
      trackingNumber: row.tracking_number,
      deliveryId: row.id,
      status: row.status,
      carrierStatus: mapping.carrierStatus,
      orderStatus: mapping.orderStatus,
      driverName: row.assigned_driver_name || null,
      rejectedReason: row.rejected_reason || null,
      pickedUpAt: row.picked_up_at || null,
      transitAt: row.transit_at || null,
      deliveredAt: row.delivered_at || null,
      acceptedAt: row.accepted_at || null,
      deliveryFee: Number(row.delivery_fee || 0),
      customerName: delivery.customerName,
      vendorName: delivery.sellerName,
    },
  };

  try {
    db.prepare(
      `INSERT INTO integration_events
       (id, provider, direction, event_id, event_type, source_order_id, delivery_id, payload_json, status, attempts, next_attempt_at)
       VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, 'pending', 0, datetime('now'))`
    ).run(makeEventId('int'), PROVIDER, eventId, eventType, row.source_order_id, row.id, JSON.stringify(payload));
  } catch (err: any) {
    // UNIQUE(provider, direction, event_id) makes retries of the same event safe.
    if (String(err?.message || '').includes('UNIQUE constraint failed')) {
      return eventId;
    }
    throw err;
  }

  return eventId;
}

export async function processTradeEaseOutbox(limit = 20): Promise<void> {
  const url = getOutboundUrl();
  const secret = getOutboundSecret();
  if (!url || !secret) return;

  const rows = db.prepare(
    `SELECT * FROM integration_events
     WHERE provider = 'TradeEase' AND direction = 'outbound'
       AND status IN ('pending','retrying')
       AND (next_attempt_at IS NULL OR next_attempt_at <= datetime('now'))
     ORDER BY created_at ASC LIMIT ?`
  ).all(limit) as any[];

  for (const row of rows) {
    const attempts = Number(row.attempts || 0) + 1;
    db.prepare(`UPDATE integration_events SET attempts = ?, status = 'sending' WHERE id = ?`).run(attempts, row.id);
    const signature = signPayload(row.payload_json, secret);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Deliveri-Signature': signature,
          'X-Deliveri-Event-Id': row.event_id,
          'X-Deliveri-Event-Type': row.event_type,
          'X-Deliveri-Spec-Version': INTEGRATION_VERSION,
          'X-Deliveri-Provider-Code': DELIVERI_PROVIDER.code,
        },
        body: row.payload_json,
      });

      if (response.ok) {
        db.prepare(
          `UPDATE integration_events SET status = 'sent', sent_at = datetime('now'), http_status = ?, last_error = NULL WHERE id = ?`
        ).run(response.status, row.id);
      } else {
        scheduleRetry(row.id, attempts, `TradeEase responded with HTTP ${response.status}`, response.status);
      }
    } catch (error: any) {
      scheduleRetry(row.id, attempts, error?.message || 'Network error', null);
    }
  }
}

function scheduleRetry(id: string, attempts: number, error: string, httpStatus: number | null) {
  // Exponential backoff: 30s, 60s, 2m, 4m, ... capped at 1 hour.
  const delaySeconds = Math.min(3600, 30 * Math.pow(2, Math.max(0, attempts - 1)));
  db.prepare(
    `UPDATE integration_events
     SET status = 'retrying', next_attempt_at = datetime('now', ?), last_error = ?, http_status = ?
     WHERE id = ?`
  ).run(`+${delaySeconds} seconds`, error.slice(0, 1000), httpStatus, id);
  console.error(`[tradeease-outbox] event ${id} attempt ${attempts} failed: ${error}. Retry in ${delaySeconds}s.`);
}

export function startTradeEaseOutboxWorker() {
  // If the process died after claiming an event but before marking it sent,
  // never leave that event permanently stuck in 'sending'. It is safe to retry
  // because TradeEase deduplicates incoming events by eventId.
  db.prepare(`
    UPDATE integration_events
       SET status = 'retrying', next_attempt_at = datetime('now'), last_error = COALESCE(last_error, 'Recovered after DELIVERI restart')
     WHERE provider = 'TradeEase' AND direction = 'outbound' AND status = 'sending'
  `).run();

  // A lightweight in-process worker is suitable for the current Railway
  // single-service deployment. The outbox is persisted in SQLite, so an
  // instance restart does not lose unsent integration events.
  const intervalMs = Number(process.env.TRADEEASE_OUTBOX_INTERVAL_MS || 10000);
  const timer = setInterval(() => {
    processTradeEaseOutbox().catch((err) => console.error('[tradeease-outbox] worker error:', err));
  }, intervalMs);
  (timer as any).unref?.();
  return timer;
}

export function getTradeEaseIntegrationStatus() {
  const counts = db.prepare(
    `SELECT status, COUNT(*) AS count FROM integration_events
     WHERE provider = 'TradeEase' GROUP BY status ORDER BY status`
  ).all() as Array<{ status: string; count: number }>;
  return {
    configured: Boolean(getOutboundUrl() && getOutboundSecret()),
    outboundUrlConfigured: Boolean(getOutboundUrl()),
    outboundSecretConfigured: Boolean(getOutboundSecret()),
    counts: Object.fromEntries(counts.map((x) => [x.status, Number(x.count)])),
  };
}

export function getRecentTradeEaseEvents(limit = 50) {
  return db.prepare(
    `SELECT id, direction, event_id, event_type, source_order_id, delivery_id,
            status, attempts, http_status, last_error, created_at, sent_at, next_attempt_at
     FROM integration_events WHERE provider = 'TradeEase'
     ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
}
