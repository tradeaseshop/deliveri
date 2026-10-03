/**
 * Seeds the DELIVERI database from the app's existing mock data
 * (src/data/mockData.ts), so the app looks the same on first run as it did
 * against localStorage. Demo passwords are set below since the mock data
 * has no password field.
 *
 * Run with: npx tsx backend/seed.ts
 */
import { randomUUID } from 'crypto';
import db from './db';
import { hashPassword } from './auth';
import { initialAdmins, initialDrivers, initialDeliveries, initialEarnings, initialNotifications } from '../src/data/mockData';

function reset() {
  db.exec(`
    DELETE FROM integration_events;
    DELETE FROM earnings;
    DELETE FROM notifications;
    DELETE FROM deliveries;
    DELETE FROM drivers;
    DELETE FROM admins;
  `);
}

function seedAdmins() {
  const insert = db.prepare(
    `INSERT INTO admins (id, name, email, password_hash, role, office_location, status, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const a of initialAdmins as any[]) {
    insert.run(a.id, a.name, a.email.toLowerCase(), hashPassword('deliveri123'), a.role, a.officeLocation, a.status, a.avatar);
  }
}

function seedDrivers() {
  const insert = db.prepare(
    `INSERT INTO drivers
      (id, name, phone, email, password_hash, vehicle_type, vehicle_plate, status, approval_status, rating, total_deliveries, earnings, current_lat, current_lng, avatar)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const d of initialDrivers as any[]) {
    insert.run(
      d.id, d.name, d.phone, d.email.toLowerCase(), hashPassword('deliveri123'), d.vehicleType, d.vehiclePlate,
      d.status, d.approvalStatus, d.rating, d.totalDeliveries, d.earnings, d.currentLat, d.currentLng, d.avatar
    );
  }
}

function seedDeliveries() {
  const insert = db.prepare(
    `INSERT INTO deliveries
      (id, tracking_number, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
       customer_name, customer_phone, seller_name, package_name, package_weight, package_value, delivery_fee,
       payment_method, payment_status, status, assigned_driver_id, assigned_driver_name, created_at,
       picked_up_at, transit_at, delivered_at, rejected_reason, qr_code_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const d of initialDeliveries as any[]) {
    insert.run(
      d.id, d.trackingNumber, d.pickupAddress, d.pickupLat, d.pickupLng, d.dropoffAddress, d.dropoffLat, d.dropoffLng,
      d.customerName, d.customerPhone, d.sellerName, d.packageName, d.packageWeight, d.packageValue, d.deliveryFee,
      d.paymentMethod, d.paymentStatus, d.status, d.assignedDriverId, d.assignedDriverName, d.createdAt,
      d.pickedUpAt || null, d.transitAt || null, d.deliveredAt || null, d.rejectedReason || null, d.qrCodeToken
    );
  }
}

function seedEarnings() {
  const insert = db.prepare(
    `INSERT INTO earnings (id, delivery_id, driver_id, amount, date, payout_status) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const e of initialEarnings as any[]) {
    const delivery = (initialDeliveries as any[]).find((d) => d.id === e.deliveryId);
    insert.run(e.id, e.deliveryId, delivery?.assignedDriverId || null, e.amount, e.date, e.payoutStatus);
  }
}

function seedNotifications() {
  const insert = db.prepare(
    `INSERT INTO notifications (id, recipient_type, recipient_id, title, body, timestamp, read, type) VALUES (?, 'admin', NULL, ?, ?, ?, ?, ?)`
  );
  for (const n of initialNotifications as any[]) {
    insert.run(randomUUID(), n.title, n.body, n.timestamp, n.read ? 1 : 0, n.type);
  }
}

export function runSeed() {
  console.log('Resetting database...');
  reset();
  console.log('Seeding admins...');
  seedAdmins();
  console.log('Seeding drivers...');
  seedDrivers();
  console.log('Seeding deliveries...');
  seedDeliveries();
  console.log('Seeding earnings...');
  seedEarnings();
  console.log('Seeding notifications...');
  seedNotifications();
  console.log('Done.\n');
}

// Only run automatically when invoked directly as a script (`npm run seed`),
// not when imported by the /api/reset-demo route.
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed();
  console.log('All seeded accounts use the password: deliveri123');
  console.log('Admin login example:  chukwuma@tradeease.com / deliveri123');
  console.log('Driver login example: chidi.anya@deliveri.ng / deliveri123');
}
