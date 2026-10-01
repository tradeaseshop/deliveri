DELIVERI: TradeEase-owned Logistics & Delivery Management Platform


DELIVERI is the logistics operating system behind TradeEase. TradeEase owns the customer and commercial journey; DELIVERI owns the execution of delivery work assigned to its logistics network. The systems communicate through authenticated service boundaries, with fulfilment identifiers connecting the commercial transaction to the physical delivery.
The platform is deliberately broader than DELIVERI itself: TradeEase can route work to DELIVERI or external logistics companies. DELIVERI therefore serves as both TradeEase's owned preferred logistics operation and a concrete implementation of the wider logistics-provider architecture.
The security model is foundational: server-side role enforcement, driver ownership checks, controlled state transitions, authenticated integration requests, idempotent event processing, retry handling, sanitised tracking, audit trails and secure secret management.

BUSINESS PURPOSE:
Provide TradeEase with an owned logistics execution capability.
Operate a dedicated Driver workspace for physical delivery personnel.
Operate an Admin workspace for logistics supervision and control.
Receive delivery jobs from TradeEase through an authenticated integration.
Return delivery events/status to TradeEase reliably.
Support live GPS/location and fleet visibility where enabled.
Support driver earnings, payouts and reconciliation.
Provide a foundation for integrating external logistics providers through the same provider architecture.

OWNERSHIP & PROVIDER STRATEGY: 
DELIVERI is a TradeEase-owned logistics platform. The provider model established in the project identifies DELIVERI as an owned and preferred provider.
Preferred does not mean exclusive. TradeEase can route delivery work to DELIVERI or to independent logistics companies. This separation lets TradeEase retain marketplace flexibility while DELIVERI remains its own logistics operation.
Architecturally, DELIVERI is both an operating logistics system and a concrete implementation of the provider contract that other logistics companies can implement.

CORE ARCHITECTURE:  
Customer places an order in TradeEase.
TradeEase creates the marketplace order and vendor-specific order/fulfilment records.
TradeEase determines that delivery is required and selects a logistics provider.
If DELIVERI is selected, TradeEase sends an authenticated delivery request.
DELIVERI validates the provider and fulfilment identifiers and creates/updates the delivery.
An authorised driver is assigned or accepts the job.
The driver progresses the delivery through permitted states.
DELIVERI records tracking and operational events.
DELIVERI sends relevant events back to TradeEase.
TradeEase correlates those events to the fulfilment and updates customer-facing status.

CANONICAL DATA FLOW:  
TradeEase Order → Vendor Order → Fulfillment → DELIVERI Delivery → Tracking Number → Driver → Delivery Status → TradeEase
This is deliberately a many-layer mapping. A customer order can contain products from several vendors, so a single parent order must not be treated as a single delivery by default.
The established multi-vendor mapping is fulfillmentId → vendorOrderId → orderId. Events may correlate orderId, orderNumber, fulfillmentId, vendorId, vendorOrderId, deliveryId, trackingNumber and provider information.

ARCHITECTURE REFERENCE:  
Customer → Cart → Order → Vendor Orders → Fulfilments → Provider Selection

                                      ↓

                              Selected Provider

                                      ↓

                         Authenticated API Request

                                      ↓

                                  DELIVERI

                         Driver / Admin / Delivery

                                      ↓

               Created → Assigned → Accepted → Picked Up

                                      ↓

                        In Transit → Delivered

                                      ↓

                       Tracking / Event / Audit

                                      ↓

                         Authenticated Webhook

                                      ↓

                                  TRADEEASE

                         Fulfilment / Order Status

                                      ↓

                                  CUSTOMER



Designed and Built by Chidindu Ejika for FAUCH Technologies
