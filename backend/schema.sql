-- DELIVERI backend schema (SQLite)
-- Models the app's existing domain (src/types.ts): admins, drivers,
-- deliveries, earnings, notifications — plus a couple of extra columns on
-- deliveries to trace which partner platform (e.g. TradeEase) an order came
-- from, so incoming webhook fulfilment requests can be correlated back.

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Office Assistant' CHECK (role IN ('Super Admin','Manager','Office Assistant','Dispatcher')),
  office_location TEXT,
  phone TEXT,
  address TEXT,
  updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On Leave')),
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'Motorcycle' CHECK (vehicle_type IN ('Motorcycle','Delivery Van','Truck','E-Bike')),
  vehicle_plate TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  vehicle_year INTEGER,
  id_type TEXT,
  id_number TEXT,
  id_document TEXT,
  emergency_contact TEXT,
  updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'Offline' CHECK (status IN ('Online','Offline')),
  approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Approved','Pending','Suspended')),
  rating REAL NOT NULL DEFAULT 5,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  earnings REAL NOT NULL DEFAULT 0,
  current_lat REAL NOT NULL DEFAULT 6.4584,
  current_lng REAL NOT NULL DEFAULT 7.5083,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  tracking_number TEXT NOT NULL UNIQUE,
  pickup_address TEXT,
  pickup_lat REAL,
  pickup_lng REAL,
  dropoff_address TEXT,
  dropoff_lat REAL,
  dropoff_lng REAL,
  customer_name TEXT,
  customer_phone TEXT,
  seller_name TEXT,
  package_name TEXT,
  package_weight REAL NOT NULL DEFAULT 0,
  package_value REAL NOT NULL DEFAULT 0,
  delivery_fee REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Paystack Card' CHECK (payment_method IN ('Paystack Card','Cash on Delivery')),
  payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Paid','Pending','Flagged')),
  status TEXT NOT NULL DEFAULT 'Assigned' CHECK (status IN ('Assigned','Picked Up','In Transit','Delivered','Rejected')),
  assigned_driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  assigned_driver_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  picked_up_at TEXT,
  transit_at TEXT,
  delivered_at TEXT,
  rejected_reason TEXT,
  qr_code_token TEXT NOT NULL,
  source_platform TEXT,   -- commerce/source platform, e.g. 'TradeEase'
  source_order_id TEXT,   -- parent order id on the source platform
  source_fulfillment_id TEXT, -- canonical shipment/fulfilment id; unique per physical delivery
  source_order_number TEXT,
  source_vendor_id TEXT,
  source_vendor_order_id TEXT,
  source_event_id TEXT,
  delivery_instructions TEXT,
  accepted_at TEXT,
  last_location_lat REAL,
  last_location_lng REAL
);

CREATE TABLE IF NOT EXISTS earnings (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  payout_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payout_status IN ('Pending','In Process','Paid')) ,
  gross_delivery_fee REAL NOT NULL DEFAULT 0,
  driver_commission REAL NOT NULL DEFAULT 100,
  platform_revenue REAL NOT NULL DEFAULT 0,
  payout_reference TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin','driver')),
  recipient_id TEXT, -- NULL means "broadcast to all admins" (used for dispatch-pool alerts)
  title TEXT NOT NULL,
  body TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  read INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('delivery','status','payout','system'))
);

CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_source ON deliveries(source_platform, source_order_id);
CREATE INDEX IF NOT EXISTS idx_earnings_driver ON earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);


-- Durable integration outbox/inbox. This makes TradeEase <-> DELIVERI
-- communication idempotent and restart-safe instead of relying on a single
-- fire-and-forget HTTP request.
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


CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, actor_type TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS driver_payouts (
  id TEXT PRIMARY KEY, driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK(amount > 0), status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Processing','Paid','Failed')),
  reference TEXT UNIQUE, notes TEXT, requested_at TEXT NOT NULL DEFAULT(datetime('now')), processed_at TEXT, processed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver ON driver_payouts(driver_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS revenue_ledger (
  id TEXT PRIMARY KEY, delivery_id TEXT REFERENCES deliveries(id) ON DELETE SET NULL,
  source_order_id TEXT, entry_type TEXT NOT NULL CHECK(entry_type IN ('delivery_fee','driver_commission','platform_revenue','adjustment')),
  amount REAL NOT NULL, description TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(delivery_id, entry_type)
);

CREATE TABLE IF NOT EXISTS reconciliation_records (
  id TEXT PRIMARY KEY, delivery_id TEXT, source_order_id TEXT, source_fulfillment_id TEXT,
  tradeease_amount REAL, deliveri_delivery_fee REAL, driver_earning REAL, platform_revenue REAL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Matched','Mismatch','Resolved')),
  notes TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')), resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_source ON reconciliation_records(source_order_id, source_fulfillment_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY, account_type TEXT NOT NULL CHECK(account_type IN ('admin','driver')), account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_account ON password_resets(account_type, account_id, expires_at);
