# TradeEase ↔ DELIVERI Integration Architecture v1.1

## 1. Responsibility boundary

**TradeEase owns commerce and logistics orchestration:** buyer, vendor, cart/checkout, order, payment, vendor fulfilment, logistics-provider selection and the parent-order/vendor-order relationship.

**DELIVERI owns DELIVERI logistics execution:** delivery job, dispatch, driver assignment, pickup, transit, tracking, delivery confirmation and DELIVERI driver earnings.

TradeEase may also integrate other logistics companies directly through their own API/webhook adapters. DELIVERI is the **owned and preferred provider**, but it is not the exclusive provider.

## 2. Provider identity

DELIVERI identifies itself to the TradeEase logistics layer as:

```json
{
  "code": "DELIVERI",
  "name": "DELIVERI",
  "owner": "TradeEase",
  "relationship": "owned",
  "networkRole": "preferred",
  "integrationVersion": "1.1"
}
```

`preferred` is a TradeEase routing policy. TradeEase remains free to route a shipment to another carrier based on availability, geography, price, SLA, capacity or other business rules.

Provider metadata is available at:

`GET /api/integrations/provider`

No secrets are returned by this endpoint.

## 3. TradeEase → DELIVERI contract

Endpoint:

`POST /api/webhooks/tradeease/orders`

Preferred envelope:

```json
{
  "specVersion": "1.1",
  "eventId": "evt_01...",
  "eventType": "order.fulfillment_requested",
  "source": "TradeEase",
  "occurredAt": "2026-09-26T12:00:00.000Z",
  "data": {
    "providerCode": "DELIVERI",
    "fulfillmentId": "VO-4821-01",
    "orderId": "TE-4821",
    "orderNumber": "TE-2026-004821",
    "vendorId": "VEN-123",
    "vendorName": "Suremart Grocery",
    "vendorOrderId": "VO-4821-01",
    "buyerName": "Amaka Obi",
    "buyerPhone": "+2348030000000",
    "deliveryAddress": "12 Ikeja Way",
    "deliveryLat": 6.6018,
    "deliveryLng": 3.3515,
    "city": "Lagos",
    "state": "Lagos",
    "pickupAddress": "Suremart Warehouse, Ikeja",
    "pickupLat": 6.60,
    "pickupLng": 3.35,
    "packageDescription": "2x Local Rice",
    "packageWeight": 4.5,
    "packageValue": 65000,
    "deliveryFee": 1500,
    "paymentMethod": "Paystack Card",
    "paymentStatus": "Paid",
    "deliveryInstructions": "Call on arrival"
  }
}
```

### Provider routing

- `providerCode = DELIVERI` → DELIVERI processes the request.
- `providerCode` naming another carrier → DELIVERI returns HTTP 202 with `ignored: true` and creates no delivery.
- Missing `providerCode` → DELIVERI assumes itself for backwards compatibility with the earlier contract.

### Multi-vendor idempotency

A TradeEase parent order may contain several vendor orders. Each physical shipment therefore has a canonical `fulfillmentId`.

DELIVERI uses:

`source_fulfillment_id = fulfillmentId || vendorOrderId || orderId`

as its delivery uniqueness/idempotency key. This prevents two vendor shipments under one parent order from being collapsed into one delivery.

DELIVERI still stores the parent `orderId` separately for correlation.

## 4. DELIVERI → TradeEase contract

Events:

- `delivery.created`
- `delivery.assigned`
- `delivery.picked_up`
- `delivery.in_transit`
- `delivery.delivered`
- `delivery.rejected`

Each event contains parent-order and fulfilment-level correlation fields:

```json
{
  "specVersion": "1.1",
  "eventId": "evt_01...",
  "eventType": "delivery.in_transit",
  "source": "DELIVERI",
  "provider": {
    "code": "DELIVERI",
    "name": "DELIVERI",
    "owner": "TradeEase",
    "relationship": "owned",
    "networkRole": "preferred"
  },
  "occurredAt": "2026-09-26T12:30:00.000Z",
  "orderId": "TE-4821",
  "orderNumber": "TE-2026-004821",
  "fulfillmentId": "VO-4821-01",
  "vendorId": "VEN-123",
  "vendorOrderId": "VO-4821-01",
  "trackingNumber": "TE-SE-123456",
  "deliveryId": "DEL-ab12cd34",
  "status": "In Transit",
  "carrierStatus": "In Transit to Destination",
  "orderStatus": "Shipped",
  "driverName": "Chidi Anya",
  "rejectedReason": null,
  "pickedUpAt": "2026-09-26T12:15:00Z",
  "transitAt": "2026-09-26T12:30:00Z",
  "deliveredAt": null,
  "data": { "...": "canonical delivery fields" }
}
```

## 5. Security

Use two HMAC-SHA256 secrets:

- `TRADEEASE_TO_DELIVERI_SECRET` — TradeEase signs inbound requests.
- `DELIVERI_TO_TRADEEASE_SECRET` — DELIVERI signs outbound requests.

Headers:

- TradeEase → DELIVERI: `X-Tradeease-Signature`
- DELIVERI → TradeEase: `X-Deliveri-Signature`
- Both directions send event ID and specification version headers.
- DELIVERI outbound also sends `X-Deliveri-Provider-Code: DELIVERI`.

The request is verified against the exact raw JSON body before processing.

The legacy `TRADEEASE_WEBHOOK_SECRET` remains supported as a compatibility fallback.

## 6. Durable outbound delivery

DELIVERI writes every outbound lifecycle event to `integration_events` before attempting HTTP delivery. A background worker retries failures with exponential backoff.

If DELIVERI restarts after an event was marked `sending`, startup moves that event back to `retrying`. This prevents an event from becoming permanently stuck because of a process crash.

TradeEase must remain idempotent because a network failure can cause a previously accepted event to be retried.

## 7. Operational visibility

Admin-only endpoints:

- `GET /api/integrations/tradeease` — configuration and outbox counts (no secrets).
- `GET /api/integrations/tradeease/events?limit=50` — Manager/Super Admin event log.
- `GET /api/integrations/provider` — read-only DELIVERI provider metadata.

## 8. TradeEase multi-provider requirement

TradeEase should maintain a provider registry/adapter model containing, at minimum:

```text
LogisticsProvider
  code
  name
  type
  ownership
  priority/preference
  capabilities
  quote endpoint
  create shipment endpoint
  tracking endpoint
  webhook endpoint
  signing configuration
```

DELIVERI is the first-class owned/preferred provider in that registry. Other carriers remain independent providers and should integrate directly with TradeEase rather than through DELIVERI.

## 9. Backward compatibility

DELIVERI continues to accept the older v2.2 flat TradeEase webhook payload. The new v1.1 contract adds provider and fulfilment-level correlation without requiring a big-bang migration.
