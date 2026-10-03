# DELIVERI v2.3 — Setup, TradeEase Integration & Operations

DELIVERI is TradeEase's owned logistics provider: one application with Driver and Admin workspaces, backed by Node.js/Express and SQLite. TradeEase remains the source of truth for commerce, vendor orders and logistics-provider selection. DELIVERI is the source of truth for DELIVERI physical fulfilment and driver operations. Other logistics providers can be integrated directly into TradeEase through their own API/webhook adapters.

The TradeEase ↔ DELIVERI connection now uses a **versioned, signed,
idempotent and durable webhook architecture**. The integration is documented
in `docs/TRADEEASE_DELIVERI_INTEGRATION.md`.

---

## 1. Running DELIVERI by itself

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

Open `http://localhost:3001`.

Seeded accounts use `deliveri123`:

- Admin: `chukwuma@tradeease.com`
- Driver: `chidi.anya@deliveri.ng`

For production, set a long random `JWT_SECRET` and use a persistent Railway
volume for `DATABASE_PATH`, such as `/data/deliveri.db`.

---

## 2. Exact TradeEase ↔ DELIVERI architecture

### TradeEase → DELIVERI

When a TradeEase order requires DELIVERI fulfilment, TradeEase sends a signed
`order.fulfillment_requested` event to:

```text
POST /api/webhooks/tradeease/orders
```

DELIVERI creates exactly one delivery job and returns:

- `deliveryId`
- `trackingNumber`
- `qrCodeToken`
- `status`
- `eventId`

The delivery stores the TradeEase correlation fields:

- `sourcePlatform`
- `sourceOrderId`
- `sourceOrderNumber`
- `sourceVendorId`
- `sourceVendorOrderId`
- `sourceEventId`

### DELIVERI → TradeEase

As the delivery progresses, DELIVERI queues lifecycle events:

```text
 delivery.created
 delivery.assigned
 delivery.picked_up
 delivery.in_transit
 delivery.delivered
 delivery.rejected
```

The events are sent to the URL in `TRADEEASE_WEBHOOK_URL`.

### Durable outbox

Outbound events are written to the `integration_events` table **before**
HTTP delivery. A background worker retries failed requests with exponential
backoff. A Railway restart therefore does not silently lose a delivery
status update.

### Idempotency

Inbound requests are deduplicated by event ID and by the TradeEase order ID.
A retry cannot create a second DELIVERI delivery for the same TradeEase fulfilment. Multi-vendor TradeEase orders can create separate physical shipments because idempotency is keyed by fulfilment/vendor-order ID rather than the parent order alone.
Outbound events also have unique event IDs.

### Security

Use two directional HMAC secrets:

```env
TRADEEASE_TO_DELIVERI_SECRET="..."
DELIVERI_TO_TRADEEASE_SECRET="..."
```

This is preferable to one secret shared in both directions. DELIVERI v2.2's
`TRADEEASE_WEBHOOK_SECRET` is still supported as a compatibility fallback.

---

## 3. Integration monitoring

Authenticated Admins can check:

```text
GET /api/integrations/tradeease
```

Managers/Super Admins can inspect recent integration events:

```text
GET /api/integrations/tradeease/events?limit=50
```

These endpoints never return webhook secrets.

---

## 4. Full test flow

With both applications running:

1. Create a TradeEase order using DELIVERI fulfilment.
2. TradeEase sends `order.fulfillment_requested`.
3. DELIVERI creates one delivery and returns its tracking number.
4. The delivery appears in the DELIVERI dispatch queue.
5. Admin assigns a driver or a driver accepts an eligible open job.
6. Driver progresses the job: **Picked Up → In Transit → Delivered**.
7. DELIVERI queues and sends the corresponding lifecycle events.
8. TradeEase receives those events and updates its order/tracking record.
9. If TradeEase is temporarily unavailable, DELIVERI keeps retrying from its
   persistent outbox instead of losing the status event.

See `docs/TRADEEASE_DELIVERI_INTEGRATION.md` for the complete payload
contract.

---

## 5. Backward compatibility

DELIVERI continues to accept the older v2.2 flat TradeEase webhook payload.
The new endpoint also accepts the structured v1 envelope. Outbound events
include both the new structured `data` object and the legacy top-level fields,
so the existing TradeEase receiver can be upgraded without requiring a
big-bang deployment.

---

## 6. Admin accounts and permissions

There is no public admin signup. Admin accounts are created by Manager or
Super Admin accounts.

| Action | Minimum role |
|---|---|
| View team/driver rosters, dispatch and assignments | Any Admin |
| Onboard, approve or suspend drivers | Dispatcher |
| Add an Admin | Manager |
| Reset demo data | Super Admin + `ALLOW_DEMO_RESET=true` |

---

## 7. Railway deployment checklist

Set:

```env
NODE_ENV=production
JWT_SECRET=<long-random-secret>
DATABASE_PATH=/data/deliveri.db
TRADEEASE_TO_DELIVERI_SECRET=<secret-matching-TradeEase>
DELIVERI_TO_TRADEEASE_SECRET=<secret-matching-TradeEase>
TRADEEASE_WEBHOOK_URL=https://<tradeease-domain>/api/webhooks/deliveri
```

Attach a persistent Railway volume mounted at `/data`.

Keep `ALLOW_DEMO_RESET=false` in production.

---

## 8. Multi-provider rule on TradeEase

TradeEase should treat DELIVERI as provider code `DELIVERI`, an owned/preferred provider — not as the only logistics provider. The matching TradeEase logistics layer should use a provider adapter/registry so additional carriers can be integrated independently. For the DELIVERI adapter, TradeEase should:

1. Generate a unique `eventId` for every fulfilment request.
2. Sign the exact raw JSON body with `TRADEEASE_TO_DELIVERI_SECRET`.
3. Store DELIVERI's `deliveryId` and `trackingNumber` on the TradeEase order.
4. Verify `X-Deliveri-Signature` using `DELIVERI_TO_TRADEEASE_SECRET`.
5. Deduplicate incoming DELIVERI events by `eventId`.
6. Treat unknown event types as safely ignorable/HTTP 202.
7. Add its own durable retry/outbox mechanism for the initial handoff.

Do not put payment credentials, passwords or unnecessary sensitive customer
information into webhook payloads.

For the detailed data contract and lifecycle mapping, see:

`docs/TRADEEASE_DELIVERI_INTEGRATION.md`

## v2.5 production integration additions

This build adds the production hardening and logistics integration layer described in `docs/PRODUCTION_GO_LIVE_CHECKLIST.md`.
Key additions include dual-workspace switching, server-enforced driver ownership, strict delivery transitions, privacy-safe public tracking, live Google Maps/GPS hooks, finance/payout/reconciliation APIs, password reset, request rate limiting, audit logs, and a persistent TradeEase fulfilment/outbox contract.
