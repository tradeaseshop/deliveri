/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ADMIN' | 'DRIVER';

export type AdminRoleType = 'Super Admin' | 'Manager' | 'Office Assistant' | 'Dispatcher';

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: AdminRoleType;
  officeLocation: string; // Lagos office zones like Ikeja, Lekki, Yaba
  status: 'Active' | 'On Leave';
  avatar?: string;
}

export interface DriverAccount {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicleType: 'Motorcycle' | 'Delivery Van' | 'Truck' | 'E-Bike';
  vehiclePlate: string;
  status: 'Online' | 'Offline';
  approvalStatus: 'Approved' | 'Pending' | 'Suspended';
  rating: number;
  totalDeliveries: number;
  earnings: number;
  currentLat: number;
  currentLng: number;
  avatar?: string;
}

export type DeliveryStatus = 'Assigned' | 'Picked Up' | 'In Transit' | 'Delivered' | 'Rejected';

export interface Delivery {
  id: string;
  trackingNumber: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  customerName: string;
  customerPhone: string;
  sellerName: string; // TradeEase Vendor
  packageName: string;
  packageWeight: number; // in kg
  packageValue: number; // in NGN (Nigerian Naira)
  deliveryFee: number; // in NGN
  paymentMethod: 'Paystack Card' | 'Cash on Delivery';
  paymentStatus: 'Paid' | 'Pending' | 'Flagged';
  status: DeliveryStatus;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  createdAt: string;
  pickedUpAt?: string;
  transitAt?: string;
  deliveredAt?: string;
  rejectedReason?: string;
  qrCodeToken: string; // Value stored inside the QR code for successful verification
  fulfillmentProvider?: 'DELIVERI' | string | null;
  providerOwner?: string | null;
  sourcePlatform?: 'TradeEase' | string | null;
  sourceOrderId?: string | null;
  sourceFulfillmentId?: string | null;
  sourceOrderNumber?: string | null;
  sourceVendorId?: string | null;
  sourceVendorOrderId?: string | null;
  sourceEventId?: string | null;
  deliveryInstructions?: string | null;
}

export interface EarningsRecord {
  id: string;
  deliveryId: string;
  amount: number;
  date: string;
  payoutStatus: 'Pending' | 'In Process' | 'Paid';
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'delivery' | 'status' | 'payout' | 'system';
}
