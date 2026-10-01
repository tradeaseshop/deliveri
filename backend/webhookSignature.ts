import crypto from 'crypto';

/**
 * Computes an HMAC-SHA256 signature over a raw JSON string using a shared
 * secret. Both DELIVERI and TradeEase compute this the same way, so each
 * side can verify a request really came from the other and wasn't forged
 * or tampered with in transit.
 */
export function signPayload(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = signPayload(rawBody, secret);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
