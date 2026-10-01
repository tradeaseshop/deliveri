import crypto from 'crypto';

// The original scheme was `${prefix}-${100 + random 0-899}` — only ~800
// possible ids per prefix, shared across every admin or every driver ever
// created, with no check before insert. This widens the space and adds a
// retry loop so a collision (still astronomically unlikely, but no longer
// "will definitely happen eventually") is handled instead of crashing the
// request with an uncaught UNIQUE constraint error.
export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Generates a fresh id and runs `insert(id)`, retrying with a new id if the
 * insert fails specifically because that id already exists. Any other
 * failure (e.g. a duplicate email) is rethrown immediately — only an id
 * collision is worth retrying.
 */
export function insertWithUniqueId<T>(prefix: string, insert: (id: string) => T, attempts = 5): { id: string; result: T } {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const id = generateId(prefix);
    try {
      const result = insert(id);
      return { id, result };
    } catch (err: any) {
      const message = err && typeof err.message === 'string' ? err.message : '';
      const isIdCollision = message.includes('UNIQUE constraint failed') && message.endsWith('.id');
      if (!isIdCollision) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}
