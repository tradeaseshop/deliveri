/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdminAccount, DriverAccount, Delivery, NotificationItem, EarningsRecord } from '../types';

export const SOUTH_EAST_HUB_COORDS = {
  lat: 6.4584, // Enugu, South East
  lng: 7.5083
};

export const LAGOS_HUB_COORDS = SOUTH_EAST_HUB_COORDS;

export const initialAdmins: AdminAccount[] = [
  {
    id: 'ADM-001',
    name: 'Chukwuma Nwosu',
    email: 'chukwuma@tradeease.com',
    role: 'Super Admin',
    officeLocation: 'Regional Headquarters, Independence Layout, Enugu',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120'
  },
  {
    id: 'ADM-002',
    name: 'Chinyere Okafor',
    email: 'chinyere.o@tradeease.com',
    role: 'Manager',
    officeLocation: 'Aladinma Hub, Owerri',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120'
  },
  {
    id: 'ADM-003',
    name: 'Nnamdi Okoye',
    email: 'nnamdi.o@tradeease.com',
    role: 'Dispatcher',
    officeLocation: 'Trans-Ekulu Fulfillment Center, Enugu',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120'
  },
  {
    id: 'ADM-004',
    name: 'Eberechi Uzor',
    email: 'eberechi.u@tradeease.com',
    role: 'Office Assistant',
    officeLocation: 'Aba-Owerri Road Transit Point, Aba',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'
  }
];

export const initialDrivers: DriverAccount[] = [
  {
    id: 'DRV-101',
    name: 'Chidi Anya',
    phone: '+234 803 123 4567',
    email: 'chidi.anya@deliveri.ng',
    vehicleType: 'Motorcycle',
    vehiclePlate: 'EN-284-ENU',
    status: 'Online',
    approvalStatus: 'Approved',
    rating: 4.8,
    totalDeliveries: 342,
    earnings: 125000,
    currentLat: 6.4589, // Enugu area
    currentLng: 7.5083,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120'
  },
  {
    id: 'DRV-102',
    name: 'Tochukwu Nwachukwu',
    phone: '+234 809 765 4321',
    email: 'tochukwu.n@deliveri.ng',
    vehicleType: 'Delivery Van',
    vehiclePlate: 'AN-592-AWK',
    status: 'Online',
    approvalStatus: 'Approved',
    rating: 4.9,
    totalDeliveries: 154,
    earnings: 210400,
    currentLat: 6.2209, // Awka
    currentLng: 7.0673,
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=120'
  },
  {
    id: 'DRV-103',
    name: 'Chiwenite Nze',
    phone: '+234 812 345 6789',
    email: 'chiwenite.nze@deliveri.ng',
    vehicleType: 'Motorcycle',
    vehiclePlate: 'IM-881-OWR',
    status: 'Offline',
    approvalStatus: 'Approved',
    rating: 4.5,
    totalDeliveries: 98,
    earnings: 45000,
    currentLat: 5.4851, // Owerri
    currentLng: 7.0350,
    avatar: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&q=80&w=120'
  },
  {
    id: 'DRV-104',
    name: 'Tochukwu Obi',
    phone: '+234 816 888 9900',
    email: 'tochukwu@deliveri.ng',
    vehicleType: 'Truck',
    vehiclePlate: 'AB-302-ABA',
    status: 'Offline',
    approvalStatus: 'Pending',
    rating: 0.0,
    totalDeliveries: 0,
    earnings: 0,
    currentLat: 5.1053, // Aba
    currentLng: 7.3702,
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=120'
  },
  {
    id: 'DRV-105',
    name: 'Ugochukwu Eze',
    phone: '+234 705 444 3322',
    email: 'ugochukwu@deliveri.ng',
    vehicleType: 'E-Bike',
    vehiclePlate: 'EN-004-EME',
    status: 'Online',
    approvalStatus: 'Suspended',
    rating: 3.9,
    totalDeliveries: 62,
    earnings: 15400,
    currentLat: 6.4431, // Emene, Enugu
    currentLng: 7.5612,
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=120'
  }
];

export const initialDeliveries: Delivery[] = [
  {
    id: 'DEL-001',
    trackingNumber: 'TE-SE-10928',
    pickupAddress: 'TradeEase Regional Warehouse, Independence Layout, Enugu',
    pickupLat: 6.4584,
    pickupLng: 7.5083,
    dropoffAddress: '14 Ikenegbu Extension, Owerri, Imo State',
    dropoffLat: 5.4851,
    dropoffLng: 7.0350,
    customerName: 'Kenechukwu Odoh',
    customerPhone: '+234 803 555 4123',
    sellerName: 'De-Eastern Electronics Hub',
    packageName: 'TradeEase HP EliteBook & Accessories',
    packageWeight: 3.5,
    packageValue: 485000,
    deliveryFee: 4500,
    paymentMethod: 'Paystack Card',
    paymentStatus: 'Paid',
    status: 'Assigned',
    assignedDriverId: 'DRV-101',
    assignedDriverName: 'Chidi Anya',
    createdAt: '2026-06-19T08:00:22-07:00',
    qrCodeToken: 'QR-TE-SE-10928'
  },
  {
    id: 'DEL-002',
    trackingNumber: 'TE-SE-88401',
    pickupAddress: 'Boutique Zone, Ariaria International Market, Aba, Abia',
    pickupLat: 5.1053,
    pickupLng: 7.3702,
    dropoffAddress: 'Akanu Ibiam International Airport Road, Emene, Enugu',
    dropoffLat: 6.4711,
    dropoffLng: 7.5582,
    customerName: 'Chibuzor Igwe',
    customerPhone: '+234 901 222 3344',
    sellerName: 'Oby Ankara & Fabrics Store',
    packageName: '5 Yards Premium Cashmere & Ankara Combo',
    packageWeight: 1.8,
    packageValue: 95000,
    deliveryFee: 3200,
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'Pending',
    status: 'Picked Up',
    assignedDriverId: 'DRV-101',
    assignedDriverName: 'Chidi Anya',
    createdAt: '2026-06-19T08:15:00-07:00',
    pickedUpAt: '2026-06-19T09:12:44-07:00',
    qrCodeToken: 'QR-TE-SE-88401'
  },
  {
    id: 'DEL-003',
    trackingNumber: 'TE-SE-47120',
    pickupAddress: 'TradeEase Food Premium Plaza, Okpara Avenue, Enugu',
    pickupLat: 6.4492,
    pickupLng: 7.4988,
    dropoffAddress: 'Owerri Mall, House of Freeda, Owerri',
    dropoffLat: 5.4820,
    dropoffLng: 7.0298,
    customerName: 'Ngozi Chukwu',
    customerPhone: '+234 812 000 1122',
    sellerName: 'Gourmet Treats TradeEase Seller',
    packageName: 'Family Box Assorted Small Chops & Juice Care Package',
    packageWeight: 4.2,
    packageValue: 35000,
    deliveryFee: 2800,
    paymentMethod: 'Paystack Card',
    paymentStatus: 'Paid',
    status: 'In Transit',
    assignedDriverId: 'DRV-102',
    assignedDriverName: 'Tochukwu Nwachukwu',
    createdAt: '2026-06-19T08:30:10-07:00',
    pickedUpAt: '2026-06-19T09:20:00-07:00',
    transitAt: '2026-06-19T09:40:15-07:00',
    qrCodeToken: 'QR-TE-SE-47120'
  },
  {
    id: 'DEL-004',
    trackingNumber: 'TE-SE-22104',
    pickupAddress: 'Anambra Electronic Plaza, Emeka Offor Market, Onitsha',
    pickupLat: 6.1343,
    pickupLng: 6.7877,
    dropoffAddress: 'Esther Obiakor Estate, Awka, Anambra',
    dropoffLat: 6.2209,
    dropoffLng: 7.0673,
    customerName: 'Chinedu Eze',
    customerPhone: '+234 802 888 7771',
    sellerName: 'Nika Smart Gadgets Shop',
    packageName: 'Samsung S24 Ultra & Silicon Case',
    packageWeight: 0.6,
    packageValue: 1250000,
    deliveryFee: 5000,
    paymentMethod: 'Paystack Card',
    paymentStatus: 'Paid',
    status: 'Delivered',
    assignedDriverId: 'DRV-101',
    assignedDriverName: 'Chidi Anya',
    createdAt: '2026-06-19T07:11:00-07:00',
    pickedUpAt: '2026-06-19T07:44:00-07:00',
    transitAt: '2026-06-19T08:02:00-07:00',
    deliveredAt: '2026-06-19T08:35:12-07:00',
    qrCodeToken: 'QR-TE-SE-22104'
  },
  {
    id: 'DEL-005',
    trackingNumber: 'TE-SE-55201',
    pickupAddress: 'TradeEase Hub Center, Trans-Ekulu, Enugu',
    pickupLat: 6.4719,
    pickupLng: 7.4912,
    dropoffAddress: 'UNIZIK Gate Road, Awka, Anambra',
    dropoffLat: 6.2255,
    dropoffLng: 7.0722,
    customerName: 'Amarachi Uzoma',
    customerPhone: '+234 708 920 2201',
    sellerName: 'TradeEase Books & Stationery',
    packageName: 'Set of 12 Academic Research Journals & Books',
    packageWeight: 8.5,
    packageValue: 42000,
    deliveryFee: 2500,
    paymentMethod: 'Paystack Card',
    paymentStatus: 'Paid',
    status: 'Assigned',
    assignedDriverId: null,
    assignedDriverName: null,
    createdAt: '2026-06-19T10:00:00-07:00',
    qrCodeToken: 'QR-TE-SE-55201'
  }
];

export const initialEarnings: EarningsRecord[] = [
  {
    id: 'ERN-001',
    deliveryId: 'DEL-004',
    amount: 5000,
    date: '2026-06-19T08:35:12-07:00',
    payoutStatus: 'Paid'
  },
  {
    id: 'ERN-002',
    deliveryId: 'DEL-003',
    amount: 2800,
    date: '2026-06-18T16:12:00-07:00',
    payoutStatus: 'Paid'
  },
  {
    id: 'ERN-003',
    deliveryId: 'DEL-002',
    amount: 3200,
    date: '2026-06-18T11:42:00-07:00',
    payoutStatus: 'In Process'
  }
];

export const initialNotifications: NotificationItem[] = [
  {
    id: 'NOT-001',
    title: 'New Delivery Request Assigned',
    body: 'Delivery TE-SE-10928 from Enugu to Owerri has been assigned to you.',
    timestamp: '2026-06-19T08:01:00-07:00',
    read: false,
    type: 'delivery'
  },
  {
    id: 'NOT-002',
    title: 'Paystack Payment Settled',
    body: 'Delivery TE-SE-22104 has been paid via Paystack Card.',
    timestamp: '2026-06-19T07:11:00-07:00',
    read: true,
    type: 'payout'
  }
];
