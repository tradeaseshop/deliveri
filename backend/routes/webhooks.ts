import 'dotenv/config';
import { Router } from 'express';
import crypto from 'crypto';
import db from '../db';
import { toDelivery } from '../serialize';
import { verifySignature } from '../webhookSignature';
import { enqueueTradeEaseEvent } from '../tradeEaseIntegration';
import { generateId } from '../ids';
import { DELIVERI_PROVIDER } from '../provider';

const router = Router();

function getInboundSecret() {
  // New name is preferred. The old name remains accepted for compatibility
  // with DELIVERI v2.2 deployments.
  return process.env.TRADEEASE_TO_DELIVERI_SECRET || process.env.TRADEEASE_WEBHOOK_SECRET || '';
}

function makeTrackingNumber() {
  for (let i = 0; i < 10; i++) {
    const candidate = `TE-SE-${100000 + crypto.randomInt(900000)}`;
    const exists = db.prepare('SELECT 1 FROM deliveries WHERE tracking_number = ?').get(candidate);
    if (!exists) return candidate;
  }
  throw new Error('Unable to generate a unique tracking number');
}

function normalizePayload(body: any) {
  const data = body?.data && typeof body.data === 'object' ? body.data : body || {};
  return {
    eventId: String(body?.eventId || body?.id || '').trim(),
    eventType: String(body?.eventType || body?.event || 'order.fulfillment_requested'),
    occurredAt: body?.occurredAt || null,
    providerCode: String(
      data.providerCode ||
      (typeof data.fulfillmentProvider === 'string' ? data.fulfillmentProvider : data.fulfillmentProvider?.code) ||
      body?.providerCode ||
      ''
    ).trim() || null,
    fulfillmentId: String(data.fulfillmentId || (typeof data.fulfillmentProvider === 'object' ? data.fulfillmentProvider?.fulfillmentId : '') || '').trim() || null,
    orderId: data.orderId,
    orderNumber: data.orderNumber || null,
    buyerName: data.buyerName,
    buyerPhone: data.buyerPhone || null,
    deliveryAddress: data.deliveryAddress,
    deliveryLat: data.deliveryLat ?? null,
    deliveryLng: data.deliveryLng ?? null,
    city: data.city || null,
    state: data.state || null,
    vendorId: data.vendorId || null,
    vendorName: data.vendorName || null,
    vendorOrderId: data.vendorOrderId || null,
    pickupAddress: data.pickupAddress || null,
    pickupLat: data.pickupLat ?? null,
    pickupLng: data.pickupLng ?? null,
    packageDescription: data.packageDescription || null,
    packageWeight: data.packageWeight ?? 0,
    packageValue: data.packageValue ?? 0,
    deliveryFee: data.deliveryFee ?? 1500,
    paymentMethod: data.paymentMethod || 'Cash on Delivery',
    paymentStatus: data.paymentStatus || 'Pending',
    deliveryInstructions: data.deliveryInstructions || null,
  };
}

/**
 * TradeEase -> DELIVERI integration endpoint.
 *
 * Preferred event envelope:
 * {
 *   specVersion: "1.0",
 *   eventId: "evt_...",
 *   eventType: "order.fulfillment_requested",
 *   source: "TradeEase",
 *   occurredAt: "2026-09-26T...Z",
 *   data: { ...order delivery fields... }
 * }
 *
 * v2.2's flat payload is still accepted for backward compatibility.
 */
router.post('/tradeease/orders', (req, res) => {
  const signature = req.headers['x-tradeease-signature'] as string | undefined;
  const headerEventId = req.headers['x-tradeease-event-id'] as string | undefined;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const secret = getInboundSecret();

  if (!secret) {
    console.error('[tradeease-inbound] secret is not configured — refusing request');
    return res.status(503).json({ error: 'TradeEase inbound webhook is not configured' });
  }
  if (!verifySignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid or missing webhook signature' });
  }

  const b = normalizePayload(req.body || {});
  if (!b.eventId && headerEventId) b.eventId = String(headerEventId).trim();
  if (b.providerCode && b.providerCode !== DELIVERI_PROVIDER.code) {
    return res.status(202).json({ accepted: true, ignored: true, reason: 'Fulfilment request is routed to another logistics provider', providerCode: b.providerCode });
  }
  if (!b.orderId || !b.buyerName || !b.deliveryAddress) {
    return res.status(400).json({ error: 'orderId, buyerName and deliveryAddress are required' });
  }
  if (b.eventType !== 'order.fulfillment_requested' && b.eventType !== 'order.delivery_requested') {
    return res.status(202).json({ accepted: true, ignored: true, eventType: b.eventType });
  }

  // Prefer TradeEase's event id. If an old client does not provide one,
  // derive a stable id from the exact signed body so webhook retries remain
  // idempotent.
  const eventId = b.eventId || `legacy_${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
  const existingEvent = db.prepare(
    `SELECT * FROM integration_events WHERE provider = 'TradeEase' AND direction = 'inbound' AND event_id = ?`
  ).get(eventId) as any;
  if (existingEvent?.delivery_id) {
    const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(existingEvent.delivery_id) as any;
    if (existing) {
      return res.status(200).json({
        accepted: true,
        provider: DELIVERI_PROVIDER.code,
        duplicate: true,
        eventId,
        deliveryId: existing.id,
        trackingNumber: existing.tracking_number,
        qrCodeToken: existing.qr_code_token,
        status: existing.status,
        estimatedDeliveryFee: existing.delivery_fee,
      });
    }
  }

  // A second idempotency guard protects retries that reuse a different event id.
  // A parent TradeEase order can have multiple vendor shipments, so the
  // physical-delivery key is fulfilmentId/vendorOrderId/orderId — NOT the
  // parent order id alone.
  const sourceFulfillmentId = b.fulfillmentId || b.vendorOrderId || b.orderId;
  const existingOrder = db.prepare(
    `SELECT * FROM deliveries WHERE source_platform = 'TradeEase' AND source_fulfillment_id = ?`
  ).get(sourceFulfillmentId) as any;
  if (existingOrder) {
    db.prepare(
      `INSERT OR IGNORE INTO integration_events
       (id, provider, direction, event_id, event_type, source_order_id, delivery_id, payload_json, status, attempts)
       VALUES (?, 'TradeEase', 'inbound', ?, ?, ?, ?, ?, 'processed', 1)`
    ).run(generateId('INT'), eventId, b.eventType, b.orderId, existingOrder.id, rawBody);
    return res.status(200).json({
      accepted: true,
      provider: DELIVERI_PROVIDER.code,
      duplicate: true,
      eventId,
      deliveryId: existingOrder.id,
      trackingNumber: existingOrder.tracking_number,
      qrCodeToken: existingOrder.qr_code_token,
      status: existingOrder.status,
      estimatedDeliveryFee: existingOrder.delivery_fee,
    });
  }

  const deliveryId = generateId('DEL');
  const trackingNumber = makeTrackingNumber();
  const qrCodeToken = `QR-${trackingNumber}`;
  const dropoffAddress = [b.deliveryAddress, b.city, b.state].filter(Boolean).join(', ');

  const create = db.transaction(() => {
    db.prepare(
      `INSERT INTO deliveries
       (id, tracking_number, pickup_address, pickup_lat, pickup_lng,
        dropoff_address, dropoff_lat, dropoff_lng, customer_name, customer_phone,
        seller_name, package_name, package_weight, package_value, delivery_fee,
        payment_method, payment_status, status, qr_code_token,
        source_platform, source_order_id, source_fulfillment_id, source_order_number, source_vendor_id,
        source_vendor_order_id, source_event_id, delivery_instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?,
               'TradeEase', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      deliveryId, trackingNumber,
      b.pickupAddress, b.pickupLat, b.pickupLng,
      dropoffAddress, b.deliveryLat, b.deliveryLng,
      b.buyerName, b.buyerPhone, b.vendorName,
      b.packageDescription, b.packageWeight, b.packageValue, b.deliveryFee,
      b.paymentMethod, b.paymentStatus, qrCodeToken,
      b.orderId, sourceFulfillmentId, b.orderNumber, b.vendorId, b.vendorOrderId, eventId, b.deliveryInstructions
    );

    db.prepare(
      `INSERT INTO integration_events
       (id, provider, direction, event_id, event_type, source_order_id, delivery_id, payload_json, status, attempts)
       VALUES (?, 'TradeEase', 'inbound', ?, ?, ?, ?, ?, 'processed', 1)`
    ).run(generateId('INT'), eventId, b.eventType, b.orderId, deliveryId, rawBody);

    db.prepare(
      `INSERT INTO notifications (id, recipient_type, recipient_id, title, body, type)
       VALUES (?, 'admin', NULL, ?, ?, 'delivery')`
    ).run(
      crypto.randomUUID(),
      'New TradeEase Order Received',
      `Order ${b.orderNumber || b.orderId} from ${b.vendorName || 'TradeEase'} is ready for dispatch. Tracking: ${trackingNumber}.`
    );
  });

  try {
    create();
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      const existing = db.prepare(
        `SELECT * FROM deliveries WHERE source_platform = 'TradeEase' AND source_fulfillment_id = ?`
      ).get(sourceFulfillmentId) as any;
      if (existing) {
        return res.status(200).json({
          accepted: true,
          provider: DELIVERI_PROVIDER.code,
          duplicate: true,
          eventId,
          deliveryId: existing.id,
          trackingNumber: existing.tracking_number,
          qrCodeToken: existing.qr_code_token,
          status: existing.status,
          estimatedDeliveryFee: existing.delivery_fee,
        });
      }
    }
    console.error('[tradeease-inbound] failed to create delivery:', error);
    return res.status(500).json({ error: 'Failed to create delivery from TradeEase order' });
  }

  // Queue the first outbound lifecycle event after the transaction commits.
  enqueueTradeEaseEvent(deliveryId, 'delivery.created');

  const row = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId) as any;
  return res.status(201).json({
    accepted: true,
    provider: DELIVERI_PROVIDER.code,
    duplicate: false,
    eventId,
    deliveryId,
    trackingNumber,
    qrCodeToken,
    status: row.status,
    estimatedDeliveryFee: row.delivery_fee,
  });
});

export default router;
