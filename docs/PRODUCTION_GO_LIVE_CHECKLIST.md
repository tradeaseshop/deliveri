# DELIVERI + TradeEase production go-live checklist

## Architecture now implemented

```text
TradeEase checkout
  └─ vendor order(s)
      └─ delivery_fulfillment record
          └─ signed order.fulfillment_requested event
              ↓
        DELIVERI inbound webhook
              └─ idempotency by eventId + fulfillmentId
              └─ creates one delivery per physical fulfilment
              └─ generates tracking number + QR token
              └─ outbound lifecycle event queue
                    ↓
              TradeEase webhook
                    └─ updates the matching fulfilment
                    └─ aggregates all fulfilments into parent order status
```

## Required Railway variables — DELIVERI
- `NODE_ENV=production`
- `DATABASE_PATH=/data/deliveri.db`
- `JWT_SECRET=<long random secret>`
- `TRADEEASE_TO_DELIVERI_SECRET=<same value configured on TradeEase>`
- `DELIVERI_TO_TRADEEASE_SECRET=<same value configured on TradeEase>`
- `TRADEEASE_WEBHOOK_URL=<TradeEase>/api/webhooks/deliveri`
- `VITE_GOOGLE_MAPS_API_KEY=<Google Maps browser key>`
- `DELIVERI_DRIVER_COMMISSION_PERCENT=70` (change to your commercial agreement)
- `APP_BASE_URL=<public DELIVERI URL>`
- `RESEND_API_KEY=<production email provider key>`
- `RESEND_FROM_EMAIL=<verified sender>`

## Required Railway variables — TradeEase
- `DELIVERI_API_URL=<public DELIVERI URL>`
- `TRADEEASE_TO_DELIVERI_SECRET=<must match DELIVERI inbound secret>`
- `DELIVERI_TO_TRADEEASE_SECRET=<must match DELIVERI outbound secret>`
- `DELIVERI_OUTBOX_INTERVAL_MS=10000`

## Google Maps
Enable Maps JavaScript API for the browser key and restrict the key by production domain/referrer.
The driver browser must also grant location permission. The Admin live map never exposes coordinates to unauthenticated/public tracking.

## Railway database
Attach a persistent volume and mount it at `/data`. Without a persistent volume, SQLite data can be lost during a redeploy.

## Financial model
DELIVERI records:
- gross delivery fee received for each fulfilment
- configurable driver commission percentage
- driver earning
- DELIVERI platform revenue
- driver payout status/reference
- reconciliation record against the TradeEase delivery fee

Do not change the commission percentage without agreeing the commercial terms.

## Security
- Never commit secrets to GitHub.
- Use different secrets for each webhook direction.
- Restrict Google Maps API keys by referrer.
- Keep `ALLOW_DEMO_RESET=false` in production.
- Review admin accounts before launch.
- Use HTTPS only.
- Review Railway logs and health endpoint after every deployment.
