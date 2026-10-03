export function toAdmin(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    officeLocation: row.office_location,
    phone: row.phone || '',
    address: row.address || '',
    status: row.status,
    avatar: row.avatar,
  };
}

export function toDriver(row: any) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address || '',
    idType: row.id_type || '',
    idNumber: row.id_number || '',
    vehicleModel: row.vehicle_model || '',
    vehicleColor: row.vehicle_color || '',
    vehicleYear: row.vehicle_year || null,
    emergencyContact: row.emergency_contact || '',
    email: row.email,
    vehicleType: row.vehicle_type,
    vehiclePlate: row.vehicle_plate,
    status: row.status,
    approvalStatus: row.approval_status,
    rating: row.rating,
    totalDeliveries: row.total_deliveries,
    earnings: row.earnings,
    currentLat: row.current_lat,
    currentLng: row.current_lng,
    locationUpdatedAt: row.location_updated_at,
    avatar: row.avatar,
  };
}

export function toDelivery(row: any) {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    pickupAddress: row.pickup_address,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    dropoffAddress: row.dropoff_address,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    sellerName: row.seller_name,
    packageName: row.package_name,
    packageWeight: row.package_weight,
    packageValue: row.package_value,
    deliveryFee: row.delivery_fee,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    assignedDriverId: row.assigned_driver_id,
    assignedDriverName: row.assigned_driver_name,
    createdAt: row.created_at,
    pickedUpAt: row.picked_up_at,
    transitAt: row.transit_at,
    deliveredAt: row.delivered_at,
    rejectedReason: row.rejected_reason,
    qrCodeToken: row.qr_code_token,
    fulfillmentProvider: row.source_platform ? 'DELIVERI' : null,
    providerOwner: row.source_platform ? 'TradeEase' : null,
    sourcePlatform: row.source_platform,
    sourceOrderId: row.source_order_id,
    sourceFulfillmentId: row.source_fulfillment_id,
    sourceOrderNumber: row.source_order_number,
    sourceVendorId: row.source_vendor_id,
    sourceVendorOrderId: row.source_vendor_order_id,
    sourceEventId: row.source_event_id,
    deliveryInstructions: row.delivery_instructions,
    acceptedAt: row.accepted_at,
  };
}

export function toEarning(row: any) {
  return {
    id: row.id,
    deliveryId: row.delivery_id,
    amount: row.amount,
    date: row.date,
    payoutStatus: row.payout_status,
    grossDeliveryFee: row.gross_delivery_fee ?? row.amount,
    driverCommission: row.driver_commission ?? null,
    platformRevenue: row.platform_revenue ?? null,
    payoutReference: row.payout_reference ?? null,
  };
}

export function toNotification(row: any) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    timestamp: row.timestamp,
    read: !!row.read,
    type: row.type,
  };
}
