# TradeEase Multi-Provider Logistics Architecture

## Core rule

TradeEase is the **logistics orchestrator**. DELIVERI is one logistics provider in that network, not the exclusive carrier.

- **TradeEase owns commerce:** cart, checkout, payment, order, vendor orders, settlement and the decision about which logistics provider fulfils a shipment.
- **DELIVERI owns DELIVERI fulfilment:** dispatch, driver assignment, pickup, transit, delivery confirmation, tracking and DELIVERI driver earnings.
- Other logistics companies should integrate with TradeEase through their own API/webhook adapters. They should not be routed through DELIVERI.

## DELIVERI's position

DELIVERI is:

- provider code: `DELIVERI`
- owned by: `TradeEase`
- relationship: `owned`
- network role: `preferred`

The `preferred` label is a TradeEase routing policy. It does **not** mean every TradeEase shipment must use DELIVERI. TradeEase may route a shipment to another provider based on geography, capacity, service type, price, SLA, availability or other business rules.

## Provider selection

TradeEase should send a fulfilment request containing:

```json
{
  "providerCode": "DELIVERI",
  "fulfillmentId": "VO-4821-01",
  "orderId": "TE-4821",
  "vendorOrderId": "VO-4821-01"
}
```

If `providerCode` is another carrier, DELIVERI safely returns HTTP 202 with `ignored: true` and does not create a delivery.

If `providerCode` is omitted, DELIVERI assumes itself for backward compatibility with the current integration contract.

## Multi-vendor order handling

A single TradeEase parent order may contain multiple `vendor_orders`. Each physical shipment must have its own `fulfillmentId` (normally the vendor-order ID).

DELIVERI therefore uses:

`source_fulfillment_id = fulfillmentId || vendorOrderId || orderId`

as the delivery idempotency key.

This prevents two vendor shipments belonging to the same parent order from being collapsed into one DELIVERI delivery.

## DELIVERI → TradeEase events

Lifecycle events include both parent-order and fulfilment-level correlation:

- `orderId`
- `orderNumber`
- `fulfillmentId`
- `vendorId`
- `vendorOrderId`
- `deliveryId`
- `trackingNumber`
- provider metadata
- delivery status/timestamps

TradeEase can therefore update the correct vendor order and parent order without guessing which shipment changed.

## Failure and retry rule

DELIVERI writes outbound lifecycle events to its durable SQLite outbox before attempting HTTP delivery. If DELIVERI restarts after an event was marked `sending`, startup moves that event back to `retrying` so it cannot remain permanently stuck.

TradeEase must remain idempotent because a network failure after the remote server accepts an event can cause a safe duplicate retry.

## What should remain on TradeEase

The TradeEase logistics layer should maintain a provider registry/adapter model similar to:

```text
LogisticsProvider
  code
  name
  type
  priority/preference
  capabilities
  quote endpoint
  create shipment endpoint
  tracking endpoint
  webhook endpoint
  signing configuration
```

DELIVERI is the first-class owned provider in that registry, but external providers remain independent adapters.
