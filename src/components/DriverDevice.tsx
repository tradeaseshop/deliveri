/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LiveMap from './LiveMap';
import * as api from '../api';
import { 
  Home, 
  Package, 
  TrendingUp, 
  User, 
  MapPin, 
  Phone, 
  Check, 
  X, 
  Navigation, 
  Clock, 
  ArrowRight, 
  QrCode, 
  Settings,
  AlertCircle,
  TrendingDown,
  Lock,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  CreditCard,
  Menu,
  Sun,
  Moon,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { Delivery, DriverAccount, NotificationItem, EarningsRecord } from '../types';
import QRScanner from './QRScanner';

interface DriverDeviceProps {
  deliveries: Delivery[];
  driver: DriverAccount;
  notifications: NotificationItem[];
  earnings: EarningsRecord[];
  onUpdateDeliveryStatus: (id: string, status: Delivery['status']) => void;
  onUpdateDriverStatus: (isOnline: boolean) => void;
  onAcceptDelivery: (id: string) => void;
  onRejectDelivery: (id: string, reason: string) => void;
  onLogout?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function DriverDevice({
  deliveries,
  driver,
  notifications,
  earnings,
  onUpdateDeliveryStatus,
  onUpdateDriverStatus,
  onAcceptDelivery,
  onRejectDelivery,
  onLogout,
  darkMode,
  onToggleDarkMode
}: DriverDeviceProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'deliveries' | 'earnings' | 'profile'>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const cached = localStorage.getItem('deliveri_driver_sidebar_collapsed');
    return cached !== 'false'; // default to collapsed style on mobile viewport size
  });
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navProgress, setNavProgress] = useState(0); // 0 to 100%
  const [eta, setEta] = useState(15); // minutes
  const [distance, setDistance] = useState(4.2); // km
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Get current active/incoming delivery assigned to this driver
  const myDeliveries = deliveries.filter(d => d.assignedDriverId === driver.id);
  const activeDeliveries = myDeliveries.filter(d => d.status !== 'Delivered' && d.status !== 'Rejected');
  const completedDeliveriesCount = myDeliveries.filter(d => d.status === 'Delivered').length;

  const currentActiveDelivery = activeDeliveries.find(d => 
    d.status === 'Picked Up' || d.status === 'In Transit' || d.status === 'Assigned'
  );

  // Earnings details
  const todayEarnings = earnings
    .filter(e => e.payoutStatus === 'Paid' || e.payoutStatus === 'In Process')
    .reduce((sum, e) => sum + e.amount, 0);

  // Route progress timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isNavigating && currentActiveDelivery) {
      timer = setInterval(() => {
        setNavProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            setIsNavigating(false);
            // Auto update to Transit or wait for actions
            if (currentActiveDelivery.status === 'Picked Up') {
              onUpdateDeliveryStatus(currentActiveDelivery.id, 'In Transit');
            }
            return 100;
          }
          const nextVal = prev + 10;
          // Dynamically reduce remaining distance and ETA
          setDistance(Math.max(0.1, parseFloat((4.2 * (1 - nextVal / 100)).toFixed(1))));
          setEta(Math.max(1, Math.round(15 * (1 - nextVal / 100))));
          return nextVal;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isNavigating, currentActiveDelivery]);

  const startNavigation = () => {
    setNavProgress(0);
    setDistance(4.2);
    setEta(15);
    setIsNavigating(true);
    if (currentActiveDelivery && currentActiveDelivery.status === 'Assigned') {
      onUpdateDeliveryStatus(currentActiveDelivery.id, 'Picked Up');
    }
  };

  const currentSelection = deliveries.find(d => d.id === selectedDeliveryId) || currentActiveDelivery;

  return (
    <div className="flex flex-col h-full bg-brand-bg text-brand-text relative select-none transition-colors duration-300">
      
      {/* Top Header of Application header */}
      <header className="bg-brand-surface text-brand-text px-4 py-3 flex justify-between items-center shadow-xs border-b border-brand-border transition-colors duration-300 z-20">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => {
              setSidebarCollapsed(prev => {
                localStorage.setItem('deliveri_driver_sidebar_collapsed', String(!prev));
                return !prev;
              });
            }}
            className="p-1.5 rounded-lg hover:bg-brand-bg text-brand-muted hover:text-brand-text cursor-pointer transition"
            title={sidebarCollapsed ? "Expand Sidebar menu" : "Collapse Sidebar menu"}
          >
            <Menu className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[9px] text-brand-primary font-bold uppercase tracking-wider block leading-none">DELIVERI Fleet</span>
            <h2 className="text-sm font-extrabold tracking-tight text-brand-text leading-tight mt-0.5">DELIVERI</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Online/Offline Badge */}
          <button 
            onClick={() => onUpdateDriverStatus(driver.status === 'Offline')}
            className={`px-2.5 py-1 text-[9px] font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
              driver.status === 'Online' 
                ? 'bg-brand-primary text-brand-surface' 
                : 'bg-brand-surface text-brand-muted border border-brand-border'
            }`}
          >
            <span className={`h-1 w-1 rounded-full ${driver.status === 'Online' ? 'bg-brand-surface animate-ping' : 'bg-brand-muted'}`}></span>
            {driver.status === 'Online' ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>
      </header>

      {/* Main Workspace Frame with collapsible navigation sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <aside className={`${sidebarCollapsed ? 'w-14' : 'w-40'} bg-brand-surface border-r border-brand-border flex flex-col flex-shrink-0 z-10 transition-all duration-300`}>
          <nav className="flex-1 p-2 space-y-1.5 flex flex-col items-center w-full">
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'deliveries', label: 'Deliveries', icon: Package, badge: activeDeliveries.length },
              { id: 'earnings', label: 'Earnings', icon: TrendingUp },
              { id: 'profile', label: 'Profile', icon: User }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSelectedDeliveryId(null); }}
                  title={tab.label}
                  className={`w-full p-2 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 cursor-pointer relative ${
                    sidebarCollapsed ? 'justify-center' : 'justify-start px-3'
                  } ${
                    activeTab === tab.id 
                      ? 'bg-brand-primary text-brand-surface shadow-xs' 
                      : 'text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-[11px] truncate">{tab.label}</span>}
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-brand-primary text-[8px] text-brand-surface font-extrabold flex items-center justify-center rounded-full border border-brand-surface">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* System controls for Driver */}
          <div className="p-2 border-t border-brand-border flex flex-col gap-1 w-full flex-shrink-0">
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                className={`w-full p-2 rounded-xl text-xs font-bold transition flex items-center gap-2.5 cursor-pointer text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text ${
                  sidebarCollapsed ? 'justify-center' : 'justify-start px-3'
                }`}
                title={darkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-500 flex-shrink-0" /> : <Moon className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                {!sidebarCollapsed && <span className="text-[11px] truncate">{darkMode ? 'Light Theme' : 'Dark Theme'}</span>}
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className={`w-full p-2 rounded-xl text-xs font-bold transition flex items-center gap-2.5 cursor-pointer text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text ${
                  sidebarCollapsed ? 'justify-center' : 'justify-start px-3'
                }`}
                title="Logout session"
              >
                <LogOut className="w-4 h-4 text-brand-muted flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-[11px] truncate">Logout</span>}
              </button>
            )}
          </div>
          
          <div className="p-2.5 border-t border-brand-border text-[8px] text-brand-muted text-center font-bold uppercase tracking-wider">
            {!sidebarCollapsed ? "TradeEase" : "T.E."}
          </div>
        </aside>

        {/* Main Screen Body */}
        <main className="flex-1 overflow-y-auto px-3.5 pt-3">
        {driver.approvalStatus !== 'Approved' ? (
          <div className="my-12 px-4 text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              driver.approvalStatus === 'Suspended' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-brand-text">
              {driver.approvalStatus === 'Suspended' ? 'Account Suspended' : 'Approval Pending'}
            </h3>
            <p className="text-xs text-brand-muted mt-2 leading-relaxed">
              {driver.approvalStatus === 'Suspended' 
                ? 'Your TradeEase driver profile was flag-suspended by Super Admin due to poor verification timing.' 
                : 'Waiting for TradeEase admin to verify your logistics license plates and driving permit.'}
            </p>
            <p className="text-[10px] text-brand-primary mt-6 font-semibold bg-brand-surface py-1.5 rounded-full inline-block px-4 border border-brand-border">
              Active Verification: {driver.vehiclePlate}
            </p>
          </div>
        ) : (
          <>
            {/* View Switching */}
            {activeTab === 'home' && (
              <div className="space-y-4">
                {/* Visual Card containing Profile Banner info */}
                <div className="bg-brand-surface border border-brand-border rounded-2xl p-4 text-brand-text relative overflow-hidden shadow-xs transition-colors duration-300">
                  <div className="absolute right-0 bottom-0 opacity-10 transform scale-150">
                    <TrendingUp className="w-32 h-32 text-brand-primary" />
                  </div>
                  <div className="flex items-center gap-3">
                    <img 
                      src={driver.avatar} 
                      alt={driver.name} 
                      className="w-12 h-12 rounded-full border-2 border-brand-primary object-cover shadow-xs"
                    />
                    <div>
                      <div className="text-[10px] text-brand-primary font-bold uppercase tracking-wide">E-LOGISTICS CARRIER</div>
                      <h3 className="text-sm font-extrabold">{driver.name}</h3>
                      <p className="text-[10px] text-brand-muted mt-0.5">{driver.vehicleType} • {driver.vehiclePlate}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-indigo-900/40 text-center">
                    <div>
                      <span className="text-[10px] text-indigo-200 block">Rating</span>
                      <span className="text-xs font-bold text-teal-300">★ {driver.rating}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-200 block">Active Status</span>
                      <span className="text-xs font-bold text-emerald-400 capitalize">{driver.status.toLowerCase()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-200 block">Completed</span>
                      <span className="text-xs font-bold text-slate-200">{completedDeliveriesCount} trips</span>
                    </div>
                  </div>
                </div>

                {/* Earnings Mini Widgets */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Daily Earnings</span>
                      <span className="text-sm font-bold text-slate-900">₦{(todayEarnings).toLocaleString()}</span>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-full text-emerald-600">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Weekly Total</span>
                      <span className="text-sm font-bold text-slate-900">₦{(driver.earnings).toLocaleString()}</span>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-full text-indigo-600">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Interactive Notification Alert */}
                {notifications.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-600 mt-1.5 animate-ping"></span>
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest">{notifications[0].title}</span>
                      <p className="text-[11px] text-indigo-700 mt-0.5 leading-snug">{notifications[0].body}</p>
                    </div>
                  </div>
                )}

                {/* Main active item quick access */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Assigned Task</h4>
                    <span className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full">Active</span>
                  </div>

                  {currentActiveDelivery ? (
                    <div className="bg-white border-2 border-indigo-500 rounded-xl p-3.5 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block">TRACKING #: {currentActiveDelivery.trackingNumber}</span>
                          <h5 className="text-xs font-bold text-slate-800 mt-0.5">{currentActiveDelivery.packageName}</h5>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg ${
                          currentActiveDelivery.status === 'Assigned' ? 'bg-amber-100 text-amber-700' :
                          currentActiveDelivery.status === 'Picked Up' ? 'bg-blue-100 text-blue-700' :
                          'bg-indigo-100 text-indigo-700 animate-pulse'
                        }`}>
                          {currentActiveDelivery.status}
                        </span>
                      </div>

                      <div className="space-y-2 border-t border-slate-100 pt-2.5">
                        <div className="flex gap-2">
                          <MapPin className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Pickup Point</span>
                            <p className="text-[10px] text-slate-600 leading-snug font-medium line-clamp-1">{currentActiveDelivery.pickupAddress}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Customer Drop-off</span>
                            <p className="text-[10px] text-slate-600 leading-snug font-medium line-clamp-1">{currentActiveDelivery.dropoffAddress}</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex gap-2">
                        <button 
                          onClick={() => {
                            setSelectedDeliveryId(currentActiveDelivery.id);
                            setActiveTab('deliveries');
                          }}
                          className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg text-center transition"
                        >
                          Details & Route
                        </button>

                        {currentActiveDelivery.status === 'Assigned' && (
                          <button 
                            onClick={startNavigation}
                            className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg text-center transition shadow-xs flex items-center justify-center gap-1"
                          >
                            <Navigation className="w-3 h-3" /> Accept & Start
                          </button>
                        )}

                        {currentActiveDelivery.status === 'In Transit' && (
                          <button 
                            onClick={() => setShowQrScanner(true)}
                            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg text-center transition shadow-xs flex items-center justify-center gap-1"
                          >
                            <QrCode className="w-3.5 h-3.5" /> Confirm Drop-off
                          </button>
                        )}

                        {currentActiveDelivery.status === 'Picked Up' && (
                          <button 
                            onClick={() => onUpdateDeliveryStatus(currentActiveDelivery.id, 'In Transit')}
                            className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg text-center transition shadow-xs flex items-center justify-center gap-1"
                          >
                            <Navigation className="w-3.5 h-3.5 animate-bounce" /> Start Transit
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-100 rounded-xl p-6 text-center border border-dashed border-slate-300">
                      <p className="text-xs text-slate-500">No active assignment right now.</p>
                      <button 
                        onClick={() => setActiveTab('deliveries')} 
                        className="text-xs text-indigo-600 font-bold mt-2 hover:underline inline-flex items-center gap-1"
                      >
                        Explore Requests <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Live GPS map inside Driver screen */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Live GPS & Navigation</h4>
                  <LiveMap drivers={[driver]} deliveries={currentActiveDelivery ? [currentActiveDelivery] : []} focusDriver={driver} compact />
                  <div className="text-[8px] text-slate-500 font-mono mt-2">GPS: {driver.currentLat.toFixed(5)}° N, {driver.currentLng.toFixed(5)}° E</div>
                </div>
              </div>
            )}

            {activeTab === 'deliveries' && (
              <div className="space-y-4">
                <div className="flex border-b border-slate-200">
                  <button 
                    onClick={() => setSelectedDeliveryId(null)}
                    className={`flex-1 pb-2 text-xs font-bold uppercase transition ${
                      !selectedDeliveryId ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    Task Feed
                  </button>
                  <button 
                    onClick={() => {
                      if (currentActiveDelivery) {
                        setSelectedDeliveryId(currentActiveDelivery.id);
                      }
                    }}
                    className={`flex-1 pb-2 text-xs font-bold uppercase transition ${
                      selectedDeliveryId ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'
                    }`}
                    disabled={!currentActiveDelivery}
                  >
                    Active Delivery
                  </button>
                </div>

                {!selectedDeliveryId ? (
                  <div className="space-y-3">
                    {deliveries.filter(d => d.assignedDriverId === driver.id || !d.assignedDriverId).length === 0 ? (
                      <div className="bg-white rounded-xl p-8 border border-dashed border-slate-200 text-center">
                        <p className="text-xs text-slate-500">No shipments found in Nigeria dispatch pipeline.</p>
                      </div>
                    ) : (
                      deliveries
                        .filter(d => d.assignedDriverId === driver.id || (!d.assignedDriverId && d.status === 'Assigned'))
                        .map(d => (
                          <div 
                            key={d.id} 
                            onClick={() => setSelectedDeliveryId(d.id)}
                            className={`bg-white rounded-xl p-3.5 border transition cursor-pointer hover:border-slate-300 ${
                              d.assignedDriverId === driver.id 
                                ? 'border-indigo-100 shadow-xs ring-1 ring-indigo-100/30' 
                                : 'border-slate-200 shadow-xs'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-[9px] text-slate-400 font-mono uppercase block">{d.trackingNumber}</span>
                                <h4 className="text-xs font-extrabold text-slate-800">{d.packageName}</h4>
                              </div>
                              <span className={`px-2 py-0.5 text-[8px] font-bold rounded-lg ${
                                d.status === 'Assigned' ? 'bg-amber-100 text-amber-700' :
                                d.status === 'Picked Up' ? 'bg-indigo-100 text-indigo-700' :
                                d.status === 'In Transit' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {d.status}
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-500 space-y-1 mb-2.5">
                              <p className="truncate"><span className="font-semibold text-slate-700">From:</span> {d.pickupAddress}</p>
                              <p className="truncate"><span className="font-semibold text-slate-700">To:</span> {d.dropoffAddress}</p>
                            </div>

                            <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 text-xs font-semibold">
                              <span className="text-teal-600 font-bold">₦{d.deliveryFee.toLocaleString()}</span>
                              <div className="flex gap-2">
                                {!d.assignedDriverId ? (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAcceptDelivery(d.id);
                                      }}
                                      className="py-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] uppercase font-extrabold"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRejectionModalId(d.id);
                                        setRejectionReason('');
                                      }}
                                      className="py-1 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] uppercase border border-rose-100"
                                    >
                                      Reject
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-indigo-600 text-[10px]">Your active task • Tap to view</span>
                                )}
                              </div>
                            </div>
                          </div>
                      ))
                    )}
                  </div>
                ) : (
                  // Detail View for Selected Delivery
                  (() => {
                    const d = deliveries.find(x => x.id === selectedDeliveryId);
                    if (!d) return <div className="text-xs text-slate-500">Not found</div>;

                    const isAssignedToMe = d.assignedDriverId === driver.id;

                    return (
                      <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3.5 shadow-sm">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[9px] text-slate-400">{d.trackingNumber}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                              d.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {d.status}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-sm font-extrabold text-slate-800">{d.packageName}</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">Seller: {d.sellerName}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-semibold text-slate-700">
                            <div>
                              <span className="text-[9px] text-slate-400 block pb-0.5">Weight</span>
                              {d.packageWeight} kg
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block pb-0.5">Value</span>
                              ₦{d.packageValue.toLocaleString()}
                            </div>
                          </div>

                          <div className="space-y-3 border-t border-slate-100 pt-3">
                            <div className="flex items-start gap-2.5">
                              <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-[9px] text-slate-400 block uppercase font-bold">Southeast Hub (Abia • Imo • Anambra • Enugu)</span>
                                <p className="text-[11px] text-slate-700 font-medium leading-relaxed">{d.pickupAddress}</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                              <MapPin className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-[9px] text-slate-400 block uppercase font-bold">Nigeria Drop-Off Point</span>
                                <p className="text-[11px] text-slate-700 font-medium leading-relaxed">{d.dropoffAddress}</p>
                              </div>
                            </div>
                          </div>

                          {/* Customer Details */}
                          <div className="border-t border-slate-100 pt-3 flex justify-between items-center bg-indigo-50/50 p-2.5 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-indigo-600" />
                              <div>
                                <span className="text-[9px] text-slate-400 block uppercase font-bold">Customer Contact</span>
                                <p className="text-[11px] text-slate-800 font-bold">{d.customerName}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">{d.customerPhone}</span>
                          </div>

                          {/* Paystack Integration widget */}
                          <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Payment Status (Paystack)</span>
                              <span className="font-mono text-[10px] text-slate-500">{d.paymentMethod}</span>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-semibold rounded-lg ${
                              d.paymentStatus === 'Paid' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {d.paymentStatus}
                            </span>
                          </div>

                          {/* Action Buttons for driver */}
                          {isAssignedToMe && (
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                              {d.status === 'Assigned' && (
                                <button 
                                  onClick={startNavigation}
                                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Navigation className="w-4 h-4" /> Start Pickup Ride
                                </button>
                              )}

                              {d.status === 'Picked Up' && (
                                <button 
                                  onClick={startNavigation}
                                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Navigation className="w-4 h-4" /> Start Delivery Route
                                </button>
                              )}

                              {isNavigating && (
                                <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-emerald-400 animate-spin" />
                                    <div>
                                      <span className="text-[8px] text-slate-400 block uppercase">Route guidance</span>
                                      <span className="text-xs font-bold font-mono text-slate-100">{distance} km remaining • {eta} mins</span>
                                    </div>
                                  </div>
                                  <div className="h-5 w-5 bg-teal-500 text-slate-950 font-bold text-[9px] flex items-center justify-center rounded-full animate-bounce">
                                    {navProgress}%
                                  </div>
                                </div>
                              )}

                              {d.status === 'In Transit' && !isNavigating && (
                                <div className="space-y-2">
                                  <div className="bg-teal-50 border border-teal-100 text-teal-800 p-2 text-center rounded-xl text-[10px] font-semibold leading-relaxed">
                                    📍 Near drop-off point! Stand by with customer to match QR verification token.
                                  </div>
                                  <button 
                                    onClick={() => setShowQrScanner(true)}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                  >
                                    <QrCode className="w-4 h-4" /> Scan QR Code
                                  </button>
                                </div>
                              )}

                              {d.status === 'Delivered' && (
                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                                  <Check className="w-5 h-5 text-emerald-600" />
                                  <div>
                                    <p>Delivery Confirmed via QR Code</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{d.deliveredAt}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {showQrScanner && (
                            <QRScanner 
                              correctToken={d.qrCodeToken} 
                              trackingNumber={d.trackingNumber}
                              onScanSuccess={(token) => {
                                setShowQrScanner(false);
                                onUpdateDeliveryStatus(d.id, 'Delivered');
                              }}
                              onScanCancel={() => {
                                setShowQrScanner(false);
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {activeTab === 'earnings' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-indigo-300 font-semibold block uppercase tracking-wider">Withdrawable Funds</span>
                      <h3 className="text-xl font-black mt-1">₦{(driver.earnings).toLocaleString()}</h3>
                    </div>
                    <span className="text-[10px] bg-indigo-900/40 text-teal-300 border border-teal-500/30 px-2 py-1 rounded-full font-bold">
                      Paystack Secure
                    </span>
                  </div>

                  <p className="text-[10px] text-indigo-200 mt-4 leading-relaxed">
                    Payouts are registered automatically into registered logistics vendor accounts on Thursdays.
                  </p>
                  <button onClick={async()=>{try{const available=earnings.filter(e=>e.payoutStatus==='Pending').reduce((a,e)=>a+e.amount,0); if(available<=0){alert('No pending earnings are available for payout.');return;} await api.requestPayout(available); alert('Payout request submitted to DELIVERI Admin.');}catch(e:any){alert(e?.message||'Payout request failed.')}}} className="mt-3 w-full py-2 rounded-lg bg-brand-primary text-brand-surface text-[10px] font-black uppercase">Request Payout</button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5 border-b border-slate-100 pb-2">Completed Logs (Paystack API)</h4>
                  
                  <div className="space-y-2">
                    {earnings.map(e => (
                      <div key={e.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs shadow-xs text-slate-700">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-500 bg-emerald-50 rounded-full p-0.5" />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-mono">{e.id}</span>
                            <span className="font-semibold">{e.deliveryId} Settlement</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-slate-900 block">₦{e.amount.toLocaleString()}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                            e.payoutStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {e.payoutStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs text-center space-y-3">
                  <img 
                    src={driver.avatar} 
                    alt={driver.name} 
                    className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-indigo-100"
                  />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">{driver.name}</h3>
                    <p className="text-xs text-slate-500">{driver.phone} • Abia-Imo-Anambra-Enugu Fleet</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
                  <div className="p-3 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Vehicle License Plate</span>
                    <span className="font-mono text-slate-700 font-bold">{driver.vehiclePlate}</span>
                  </div>
                  <div className="p-3 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Total Shipments Route</span>
                    <span className="font-bold text-slate-800">{driver.totalDeliveries} Completed</span>
                  </div>
                  <div className="p-3 flex justify-between items-center text-xs text-brand-text">
                    <span className="text-brand-muted font-medium">System Role</span>
                    <span className="font-bold text-brand-primary bg-brand-bg px-2.5 py-0.5 rounded-full uppercase text-[10px] border border-brand-border">TradeEase DRIVER</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>

      {/* Rejection Modal */}
      {rejectionModalId && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-40">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-4 w-full max-w-sm space-y-4 text-brand-text transition-colors">
            <h3 className="text-sm font-bold text-brand-text">Reject Delivery Request</h3>
            <textarea
              placeholder="Explain reason for rejecting (e.g., Heavy luggage, vehicle flat tyre, wrong road route)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-brand-primary focus:outline-hidden"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onRejectDelivery(rejectionModalId, rejectionReason);
                  setRejectionModalId(null);
                  setRejectionReason('');
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                disabled={!rejectionReason.trim()}
              >
                Confirm Reject
              </button>
              <button
                onClick={() => setRejectionModalId(null)}
                className="flex-1 py-2 bg-brand-bg hover:bg-brand-surface-hover text-brand-text border border-brand-border rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
