/** Canonical identity of the DELIVERI carrier inside the TradeEase network. */
export const DELIVERI_PROVIDER = {
  code: 'DELIVERI',
  name: 'DELIVERI',
  owner: 'TradeEase',
  relationship: 'owned',
  networkRole: 'preferred',
  integrationVersion: '1.1',
} as const;

export const DELIVERI_CAPABILITIES = [
  'delivery.created',
  'delivery.assigned',
  'delivery.picked_up',
  'delivery.in_transit',
  'delivery.delivered',
  'delivery.rejected',
] as const;

export function providerDescriptor() {
  return {
    ...DELIVERI_PROVIDER,
    capabilities: [...DELIVERI_CAPABILITIES],
    inbound: {
      method: 'POST',
      path: '/api/webhooks/tradeease/orders',
      signatureHeader: 'X-Tradeease-Signature',
    },
    outbound: {
      signatureHeader: 'X-Deliveri-Signature',
      eventIdHeader: 'X-Deliveri-Event-Id',
    },
  };
}
