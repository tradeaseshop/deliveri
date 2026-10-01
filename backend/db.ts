import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const BACKEND_DIR = path.join(process.cwd(), 'backend');
const DB_PATH = process.env.DATABASE_PATH || (process.env.NODE_ENV === 'production' ? '/data/deliveri.db' : path.join(BACKEND_DIR, 'deliveri.db'));

// Railway deployments should point DATABASE_PATH at a persistent volume.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(BACKEND_DIR, 'schema.sql'), 'utf-8');
db.exec(schema);

// Lightweight, idempotent migrations for databases created by DELIVERI v2.2.
// CREATE TABLE IF NOT EXISTS cannot add columns to an existing SQLite table,
// so we add the new integration fields when an older Railway DB is reused.
function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('deliveries', 'source_fulfillment_id', 'TEXT');
ensureColumn('deliveries', 'source_order_number', 'TEXT');
ensureColumn('deliveries', 'source_vendor_id', 'TEXT');
ensureColumn('deliveries', 'source_vendor_order_id', 'TEXT');
ensureColumn('deliveries', 'source_event_id', 'TEXT');
ensureColumn('deliveries', 'delivery_instructions', 'TEXT');
ensureColumn('deliveries', 'accepted_at', 'TEXT');
ensureColumn('deliveries', 'last_location_lat', 'REAL');
ensureColumn('deliveries', 'last_location_lng', 'REAL');
ensureColumn('drivers', 'location_updated_at', 'TEXT');
ensureColumn('earnings', 'gross_delivery_fee', 'REAL NOT NULL DEFAULT 0');
ensureColumn('earnings', 'driver_commission', 'REAL NOT NULL DEFAULT 100');
ensureColumn('earnings', 'platform_revenue', 'REAL NOT NULL DEFAULT 0');
ensureColumn('earnings', 'payout_reference', 'TEXT');

db.exec(`
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_type TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS driver_payouts (id TEXT PRIMARY KEY, driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Processing','Paid','Failed')), reference TEXT UNIQUE, notes TEXT, requested_at TEXT NOT NULL DEFAULT(datetime('now')), processed_at TEXT, processed_by TEXT);
CREATE TABLE IF NOT EXISTS revenue_ledger (id TEXT PRIMARY KEY, delivery_id TEXT REFERENCES deliveries(id) ON DELETE SET NULL, source_order_id TEXT, entry_type TEXT NOT NULL, amount REAL NOT NULL, description TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(delivery_id, entry_type));
CREATE TABLE IF NOT EXISTS reconciliation_records (id TEXT PRIMARY KEY, delivery_id TEXT, source_order_id TEXT, source_fulfillment_id TEXT, tradeease_amount REAL, deliveri_delivery_fee REAL, driver_earning REAL, platform_revenue REAL, status TEXT NOT NULL DEFAULT 'Pending', notes TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')), resolved_at TEXT);
CREATE TABLE IF NOT EXISTS password_resets (id TEXT PRIMARY KEY, account_type TEXT NOT NULL, account_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver ON driver_payouts(driver_id, requested_at DESC);
`);

// v2.4 migration: one TradeEase parent order may contain multiple vendor
// orders/shipments. Older DELIVERI versions treated source_order_id as the
// unique delivery key, which incorrectly collapsed multi-vendor fulfilment.
// We now use source_fulfillment_id (vendorOrderId/fulfilmentId when supplied,
// otherwise the parent order id) as the physical-shipment idempotency key.
db.exec(`
  DROP INDEX IF EXISTS uq_deliveries_source_order;
  UPDATE deliveries
     SET source_fulfillment_id = COALESCE(NULLIF(source_fulfillment_id, ''), NULLIF(source_vendor_order_id, ''), source_order_id)
   WHERE source_fulfillment_id IS NULL OR source_fulfillment_id = '';
  CREATE INDEX IF NOT EXISTS idx_deliveries_fulfillment
    ON deliveries(source_platform, source_fulfillment_id);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_deliveries_source_fulfillment
    ON deliveries(source_platform, source_fulfillment_id)
    WHERE source_platform IS NOT NULL AND source_fulfillment_id IS NOT NULL;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS integration_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source_order_id TEXT,
    delivery_id TEXT REFERENCES deliveries(id) ON DELETE SET NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','retrying','processed','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    http_status INTEGER,
    last_error TEXT,
    next_attempt_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    UNIQUE(provider, direction, event_id)
  );
  CREATE INDEX IF NOT EXISTS idx_integration_events_status
    ON integration_events(provider, direction, status, next_attempt_at);
  CREATE INDEX IF NOT EXISTS idx_integration_events_order
    ON integration_events(provider, source_order_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_deliveries_source_order
    ON deliveries(source_platform, source_order_id);
  CREATE INDEX IF NOT EXISTS idx_deliveries_fulfillment_id
    ON deliveries(source_platform, source_fulfillment_id);
`);

export default db;
