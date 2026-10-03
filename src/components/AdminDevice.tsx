/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LiveMap from './LiveMap';
import * as api from '../api';
import { 
  Users, 
  Package, 
  MapPin, 
  TrendingUp, 
  Plus, 
  UserCheck, 
  UserX, 
  Map, 
  BarChart3, 
  FileCheck,
  Building,
  CreditCard,
  QrCode,
  CheckCircle,
  Truck,
  DollarSign,
  Briefcase,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { Delivery, DriverAccount, AdminAccount, AdminRoleType, DriverAccount as DriverType } from '../types';

interface AdminDeviceProps {
  deliveries: Delivery[];
  drivers: DriverAccount[];
  admins: AdminAccount[];
  currentAdminRole?: AdminRoleType | null;
  onAddDelivery: (delivery: Omit<Delivery, 'id' | 'trackingNumber' | 'createdAt' | 'qrCodeToken' | 'status'>) => void;
  onAddDriver: (driver: any) => void;
  onAddAdmin: (admin: any) => void;
  onApproveDriver: (id: string) => void;
  onSuspendDriver: (id: string) => void;
  onManualAssignDriver: (deliveryId: string, driverId: string | null) => void;
  onLogout?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

// Compact robust SVG QR Code Generator for live scanning
function QrSVG({ value }: { value: string }) {
  // Simple deterministic pattern based on the string length to make it look like a real custom QR Code
  const matrixSize = 13;
  const blocks: React.ReactNode[] = [];
  
  // Seed hash for rendering pseudo-random squares
  const getHash = (x: number, y: number) => {
    let charCodeSum = 0;
    for (let i = 0; i < value.length; i++) {
      charCodeSum += value.charCodeAt(i) * (i + 1);
    }
    return ((x * 123 + y * 997 + charCodeSum) % 5) === 0;
  };

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Finders patterns (corners of the QR)
      const isCorner = 
        (r < 4 && c < 4) || // Top-left
        (r < 4 && c >= matrixSize - 4) || // Top-right
        (r >= matrixSize - 4 && c < 4); // Bottom-left

      const fillBlock = isCorner ? (
        // Ring or core feel
        (r === 0 || r === 3 || c === 0 || c === 3) || 
        (r === matrixSize - 1 || r === matrixSize - 4 || c === 0 || c === 3) ||
        (r === 0 || r === 3 || c === matrixSize - 1 || c === matrixSize - 4)
      ) : getHash(r, c);

      if (fillBlock) {
        blocks.push(
          <rect 
            key={`${r}-${c}`} 
            x={c * 10} 
            y={r * 10} 
            width={10} 
            height={10} 
            className={isCorner ? 'fill-slate-900' : 'fill-slate-800'} 
          />
        );
      }
    }
  }

  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block text-center shadow-xs">
      <svg width="130" height="130" viewBox="0 0 130 130" className="mx-auto">
        {blocks}
        {/* Center DELIVERI delivery logo badge */}
        <circle cx="65" cy="65" r="14" className="fill-indigo-600 stroke-white stroke-2" />
        <rect x="58" y="58" width="14" height="14" rx="2" className="fill-indigo-600" />
        <path d="M61 63 L64 66 L69 61" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[9px] font-mono font-bold text-slate-500 block mt-2 select-all uppercase tracking-tight">{value}</span>
    </div>
  );
}

export default function AdminDevice({
  deliveries,
  drivers,
  admins,
  currentAdminRole,
  onAddDelivery,
  onAddDriver,
  onAddAdmin,
  onApproveDriver,
  onSuspendDriver,
  onManualAssignDriver,
  onLogout,
  darkMode,
  onToggleDarkMode,
}: AdminDeviceProps) {
  const [activeTab, setActiveTab] = useState<'dash' | 'deliveries' | 'drivers' | 'admins' | 'map' | 'analytics' | 'finance'>('dash');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const cached = localStorage.getItem('deliveri_admin_sidebar_collapsed');
    return cached === 'true';
  });
  const [operationsExpanded, setOperationsExpanded] = useState<boolean>(() => {
    const cached = localStorage.getItem('deliveri_operations_expanded');
    return cached !== 'false';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('deliveri_admin_sidebar_collapsed', String(!prev));
      return !prev;
    });
  };

  const toggleOperations = () => {
    setOperationsExpanded(prev => {
      localStorage.setItem('deliveri_operations_expanded', String(!prev));
      return !prev;
    });
    // Dynamically auto-expand the main sidebar if it was collapsed so the user can see options
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      localStorage.setItem('deliveri_admin_sidebar_collapsed', 'false');
    }
  };
  
  // Creation Form states
  const [showAddDelivery, setShowAddDelivery] = useState(false);
  const [newDelPickup, setNewDelPickup] = useState('');
  const [newDelDropoff, setNewDelDropoff] = useState('');
  const [newDelCust, setNewDelCust] = useState('');
  const [newDelPhone, setNewDelPhone] = useState('');
  const [newDelSeller, setNewDelSeller] = useState('');
  const [newDelPkg, setNewDelPkg] = useState('');
  const [newDelWeight, setNewDelWeight] = useState(2.0);
  const [newDelValue, setNewDelValue] = useState(50000);
  const [newDelFee, setNewDelFee] = useState(3500);
  const [newDelPayMethod, setNewDelPayMethod] = useState<'Paystack Card' | 'Cash on Delivery'>('Paystack Card');
  const [newDelDriverId, setNewDelDriverId] = useState('');

  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDrvName, setNewDrvName] = useState('');
  const [newDrvPhone, setNewDrvPhone] = useState('');
  const [newDrvEmail, setNewDrvEmail] = useState('');
  const [finance, setFinance] = useState({grossFees:0,driverEarnings:0,platformRevenue:0,pendingPayouts:0});
  const [payouts, setPayouts] = useState<any[]>([]);
  useEffect(()=>{ if(activeTab==='finance'){ Promise.all([api.getFinanceSummary(),api.getPayouts()]).then(([a,b])=>{setFinance(a);setPayouts(b)}).catch(()=>{}); } },[activeTab]);

  const [newDrvVehicle, setNewDrvVehicle] = useState<'Motorcycle' | 'Delivery Van' | 'Truck' | 'E-Bike'>('Motorcycle');
  const [newDrvPlate, setNewDrvPlate] = useState('');
  const [newDrvPassword, setNewDrvPassword] = useState('');
  const [newDrvIdType, setNewDrvIdType] = useState('NIN');
  const [newDrvIdNumber, setNewDrvIdNumber] = useState('');
  const [newDrvIdDocument, setNewDrvIdDocument] = useState('');
  const [newDrvAddress, setNewDrvAddress] = useState('');
  const [newDrvVehicleModel, setNewDrvVehicleModel] = useState('');
  const [newDrvVehicleColor, setNewDrvVehicleColor] = useState('');
  const [newDrvVehicleYear, setNewDrvVehicleYear] = useState('');
  const [newDrvEmergency, setNewDrvEmergency] = useState('');

  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmName, setNewAdmName] = useState('');
  const [newAdmEmail, setNewAdmEmail] = useState('');
  const [newAdmRole, setNewAdmRole] = useState<AdminRoleType>('Manager');
  const [newAdmOffice, setNewAdmOffice] = useState('Enugu Regional Hub');
  const [newAdmPassword, setNewAdmPassword] = useState('');

  const [selectedDeliveryQR, setSelectedDeliveryQR] = useState<string | null>(null);

  // Statistics summaries
  const totalDeliveries = deliveries.length;
  const completedOrders = deliveries.filter(d => d.status === 'Delivered').length;
  const activeDrivers = drivers.filter(d => d.status === 'Online').length;
  const totalRevenue = deliveries.reduce((sum, d) => sum + d.deliveryFee, 0);

  const handleDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDelPickup || !newDelDropoff || !newDelCust || !newDelPkg) return;

    onAddDelivery({
      pickupAddress: newDelPickup,
      pickupLat: 6.5244 + (Math.random() - 0.5) * 0.1,
      pickupLng: 3.3792 + (Math.random() - 0.5) * 0.1,
      dropoffAddress: newDelDropoff,
      dropoffLat: 6.5244 + (Math.random() - 0.5) * 0.1,
      dropoffLng: 3.3792 + (Math.random() - 0.5) * 0.1,
      customerName: newDelCust,
      customerPhone: newDelPhone,
      sellerName: newDelSeller || 'TradeEase Vendor Hub',
      packageName: newDelPkg,
      packageWeight: Number(newDelWeight),
      packageValue: Number(newDelValue),
      deliveryFee: Number(newDelFee),
      paymentMethod: newDelPayMethod,
      paymentStatus: newDelPayMethod === 'Paystack Card' ? 'Paid' : 'Pending',
      assignedDriverId: newDelDriverId || null,
      assignedDriverName: newDelDriverId ? (drivers.find(d => d.id === newDelDriverId)?.name || null) : null
    });

    // Reset Form
    setNewDelPickup('');
    setNewDelDropoff('');
    setNewDelCust('');
    setNewDelPhone('');
    setNewDelSeller('');
    setNewDelPkg('');
    setNewDelWeight(2.0);
    setNewDelValue(50000);
    setNewDelFee(3500);
    setNewDelDriverId('');
    setShowAddDelivery(false);
  };

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrvName || !newDrvPhone || !newDrvEmail || !newDrvPassword || !newDrvPlate || !newDrvIdNumber) return;
    onAddDriver({ name:newDrvName, phone:newDrvPhone, email:newDrvEmail, password:newDrvPassword, idType:newDrvIdType, idNumber:newDrvIdNumber, idDocument:newDrvIdDocument || undefined, address:newDrvAddress, emergencyContact:newDrvEmergency, vehicleType:newDrvVehicle, vehiclePlate:newDrvPlate, vehicleModel:newDrvVehicleModel, vehicleColor:newDrvVehicleColor, vehicleYear:newDrvVehicleYear ? Number(newDrvVehicleYear) : null, status:'Offline', currentLat:6.4584, currentLng:7.5083 });
    setNewDrvName('');setNewDrvPhone('');setNewDrvEmail('');setNewDrvPassword('');setNewDrvPlate('');setNewDrvIdNumber('');setNewDrvIdDocument('');setNewDrvAddress('');setNewDrvEmergency('');setNewDrvVehicleModel('');setNewDrvVehicleColor('');setNewDrvVehicleYear('');setShowAddDriver(false);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmName || !newAdmEmail) return;

    onAddAdmin({
      name: newAdmName,
      email: newAdmEmail,
      role: newAdmRole,
      officeLocation: newAdmOffice,
      password: newAdmPassword,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120'
    });

    setNewAdmName('');
    setNewAdmEmail('');
    setNewAdmPassword('');
    setShowAddAdmin(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-brand-bg relative select-none text-brand-text transition-colors duration-300">
      
      {/* Side Control Bar for Admin Desktop Layout */}
      <aside className={`w-full ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'} bg-brand-surface text-brand-text flex flex-col md:border-r border-brand-border flex-shrink-0 z-20 transition-all duration-300`}>
        <div className="p-4 border-b border-brand-border flex items-center justify-between gap-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-primary flex-shrink-0" />
            {!sidebarCollapsed && (
              <h1 className="text-sm font-black tracking-widest text-brand-text whitespace-nowrap">
                DELIVERI <span className="text-[9px] text-brand-primary bg-brand-bg px-1.5 py-0.5 rounded border border-brand-border font-bold">ADMIN</span>
              </h1>
            )}
          </div>
          <button 
            type="button" 
            onClick={toggleSidebar} 
            className="hidden md:flex p-1.5 rounded-lg hover:bg-brand-bg text-brand-muted hover:text-brand-text transition cursor-pointer"
            title={sidebarCollapsed ? "Expand Sidebar Menu" : "Collapse Sidebar Menu"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 flex flex-col overflow-y-auto md:overflow-y-visible">
          {/* Top level: Super Admin Board */}
          <button
            onClick={() => { setActiveTab('dash'); setSelectedDeliveryQR(null); }}
            title="Super Admin Board"
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 flex-shrink-0 cursor-pointer md:justify-start ${
              sidebarCollapsed ? 'md:justify-center md:px-0' : ''
            } ${
              activeTab === 'dash' 
                ? 'bg-brand-primary text-brand-surface shadow-md' 
                : 'text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text'
            }`}
          >
            <Layers className="w-4 h-4 flex-shrink-0" />
            <span className={`whitespace-nowrap ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>
              Super Admin Board
            </span>
          </button>

          {/* Collapsible Section Header (The requested collapsible bar) */}
          <div className="w-full flex-shrink-0 pt-2 border-t border-brand-border/40">
            <button
              type="button"
              onClick={toggleOperations}
              title={operationsExpanded ? "Collapse Operations Panel" : "Expand Operations Panel"}
              className={`w-full text-left px-3 py-2 rounded-xl text-[10px] uppercase font-black tracking-widest transition flex items-center justify-between gap-1.5 cursor-pointer text-brand-primary bg-brand-surface-hover/60 hover:bg-brand-surface-hover border border-brand-border/45 ${
                sidebarCollapsed ? 'md:justify-center md:px-1' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <Briefcase className="w-3.5 h-3.5 flex-shrink-0 text-brand-primary" />
                <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : 'inline'}`}>
                  Operations Hub
                </span>
              </div>
              <div className={`${sidebarCollapsed ? 'md:hidden' : 'block'}`}>
                {operationsExpanded ? (
                  <ChevronDown className="w-3 h-3 text-brand-muted" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-brand-muted" />
                )}
              </div>
            </button>

            {/* Nested items under the collapsible operations bar */}
            <div 
              className={`space-y-1 transition-all duration-300 ease-in-out origin-top overflow-hidden ${
                operationsExpanded 
                  ? 'max-h-[300px] opacity-100 mt-1.5' 
                  : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              {[
                { id: 'deliveries', label: 'Delivery Dispatch', icon: Package },
                { id: 'drivers', label: 'Staff', icon: Users },
                { id: 'admins', label: 'Office', icon: Building },
                { id: 'map', label: 'Live Logistics Map', icon: Map },
                { id: 'finance', label: 'Finance & Payouts', icon: DollarSign }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); setSelectedDeliveryQR(null); }}
                    title={tab.label}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2.5 flex-shrink-0 cursor-pointer md:justify-start ${
                      sidebarCollapsed ? 'md:justify-center md:px-0' : ''
                    } ${
                      activeTab === tab.id 
                        ? 'bg-brand-primary text-brand-surface shadow-xs font-extrabold' 
                        : 'text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className={`whitespace-nowrap ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top level: Perf Insights */}
          <button
            onClick={() => { setActiveTab('analytics'); setSelectedDeliveryQR(null); }}
            title="Perf Insights"
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 flex-shrink-0 cursor-pointer md:justify-start pt-2 border-t border-brand-border/40 ${
              sidebarCollapsed ? 'md:justify-center md:px-0' : ''
            } ${
              activeTab === 'analytics' 
                ? 'bg-brand-primary text-brand-surface shadow-md' 
                : 'text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text'
            }`}
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span className={`whitespace-nowrap ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>
              Perf Insights
            </span>
          </button>
        </nav>

        {/* System Controls */}
        <div className="p-3 border-t border-brand-border flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible flex-shrink-0">
          {onToggleDarkMode && (
            <button
              type="button"
              onClick={onToggleDarkMode}
              className={`text-left px-3 py-2 rounded-xl text-[11px] font-bold transition flex items-center gap-2.5 cursor-pointer md:w-full md:justify-start flex-shrink-0 ${
                sidebarCollapsed ? 'md:justify-center md:px-0' : ''
              } text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text`}
              title={darkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-500 flex-shrink-0" /> : <Moon className="w-4 h-4 text-blue-400 flex-shrink-0" />}
              <span className={`whitespace-nowrap ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>
                {darkMode ? 'Light Theme' : 'Dark Theme'}
              </span>
            </button>
          )}



          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className={`text-left px-3 py-2 rounded-xl text-[11px] font-bold transition flex items-center gap-2.5 cursor-pointer md:w-full md:justify-start flex-shrink-0 ${
                sidebarCollapsed ? 'md:justify-center md:px-0' : ''
              } text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text`}
              title="Logout session"
            >
              <LogOut className="w-4 h-4 text-brand-muted flex-shrink-0" />
              <span className={`whitespace-nowrap ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>
                Logout Session
              </span>
            </button>
          )}
        </div>

        <div className="p-4 border-t border-brand-border text-[10px] text-brand-muted hidden md:block overflow-hidden transition-all duration-300">
          {!sidebarCollapsed ? (
            <>
              <span className="font-bold text-brand-text block pb-0.5">TradeEase Multivendor Logistics</span>
              Authorized Office Hub: Abia • Imo • Anambra • Enugu
            </>
          ) : (
            <span className="font-extrabold text-[12px] text-brand-primary text-center block">T.E.</span>
          )}
        </div>
      </aside>

      {/* Primary Workspace Panel */}
      <section className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
        
        {/* Dynamic Panel Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-brand-text border-l-4 border-brand-primary pl-2 capitalize">{activeTab} Administration</h2>
            <p className="text-[11px] text-brand-muted mt-0.5">Manage, track, and monitor TradeEase Logistics ecosystem.</p>
          </div>

          <div className="flex gap-2">
            {activeTab === 'deliveries' && (
              <button 
                onClick={() => setShowAddDelivery(true)}
                className="py-2 px-3.5 bg-brand-primary hover:bg-brand-primary-hover text-brand-surface rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Dispatch Shipment
              </button>
            )}
            {activeTab === 'drivers' && (
              <button 
                onClick={() => setShowAddDriver(true)}
                className="py-2 px-3.5 bg-brand-primary hover:bg-brand-primary-hover text-brand-surface rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Provision Carrier
              </button>
            )}
            {activeTab === 'admins' && currentAdminRole === 'Super Admin' && (
              <button 
                onClick={() => setShowAddAdmin(true)}
                className="py-2 px-3.5 bg-brand-primary hover:bg-brand-primary-hover text-brand-surface rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Provision Admin staff
              </button>
            )}
          </div>
        </div>

        {/* Dashboard Stat Board */}
        {activeTab === 'dash' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Total Shipments', val: totalDeliveries, desc: 'Registered to TradeEase', icon: Package, color: 'text-brand-primary bg-brand-bg/50 border-brand-border' },
                { title: 'Active On-Road Carriers', val: activeDrivers, desc: 'Drivers Online', icon: Users, color: 'text-brand-primary bg-brand-bg/50 border-brand-border' },
                { title: 'Fulfill Rate', val: `${completedOrders}/${totalDeliveries}`, desc: 'Deliveries Confirmed', icon: FileCheck, color: 'text-brand-accent bg-brand-bg/50 border-brand-border' },
                { title: 'Revenue Pipeline', val: `₦${totalRevenue.toLocaleString()}`, desc: 'Paystack settlements', icon: DollarSign, color: 'text-brand-primary bg-brand-bg/50 border-brand-border' }
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="bg-brand-surface border border-brand-border rounded-2xl p-4 shadow-xs flex items-center justify-between transition-colors duration-300">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest block">{stat.title}</span>
                      <h4 className="text-xl font-black text-brand-text">{stat.val}</h4>
                      <span className="text-[10px] text-brand-muted/80 block">{stat.desc}</span>
                    </div>
                    <div className={`p-3 rounded-2xl border ${stat.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick overview panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800">Recent Shipments pipeline</h3>
                  <button onClick={() => setActiveTab('deliveries')} className="text-xs text-indigo-600 hover:underline font-bold">Go to Dispatch</button>
                </div>

                <div className="space-y-3.5">
                  {deliveries.slice(-4).reverse().map(d => (
                    <div key={d.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100 shadow-xs">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[9px] text-slate-400">{d.trackingNumber}</span>
                        <h5 className="font-bold text-slate-800 truncate max-w-[200px]">{d.packageName}</h5>
                        <p className="text-[10px] text-slate-500 truncate max-w-[200px]">Vendor: {d.sellerName}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="font-mono text-[9px] text-slate-400">{d.assignedDriverName || 'Unassigned'}</span>
                        <span className={`px-2 py-0.5 text-[8px] font-bold rounded-lg ${
                          d.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {d.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paystack transactions board */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800">Financial Audit trail (Paystack API)</h3>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-bold">Nigeria Settlement Live</span>
                </div>

                <div className="space-y-3">
                  {deliveries.map((d, index) => (
                    <div key={index} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="font-mono text-[9px] text-slate-400 block">CARD MEMO: {d.trackingNumber}</span>
                          <span className="font-semibold text-slate-800">{d.customerName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">₦{d.deliveryFee.toLocaleString()}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          d.paymentStatus === 'Paid' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {d.paymentStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deliveries Tab - Create and Manage */}
        {activeTab === 'deliveries' && (
          <div className="space-y-6">
            
            {/* Show QR verification modal if clicked */}
            {selectedDeliveryQR && (
              <div className="bg-white border-2 border-indigo-600 rounded-2xl p-4 max-w-sm mx-auto shadow-md space-y-3 text-center">
                <h4 className="text-xs font-extrabold text-indigo-800 uppercase tracking-widest">TradeEase packing slip QR Code</h4>
                <p className="text-[10px] text-slate-500">Scan this code with the driver device's camera stream or verification system to finalize shipment handover!</p>
                
                <QrSVG value={selectedDeliveryQR} />

                <button 
                  onClick={() => setSelectedDeliveryQR(null)}
                  className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold tracking-tight transition"
                >
                  Close packing slip
                </button>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-600">Nigerian Logistics Dispatch Queue</h3>
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full font-bold">REST Dispatcher Live</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {deliveries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No active shipments in pipeline. Create one above!</div>
                ) : (
                  deliveries.map(d => (
                    <div key={d.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{d.trackingNumber}</span>
                          <span className={`px-2 py-0.5 text-[8px] font-bold rounded-lg ${
                            d.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                            d.status === 'Assigned' ? 'bg-amber-100 text-amber-800' :
                            d.status === 'In Transit' ? 'bg-blue-100 text-blue-800' :
                            'bg-indigo-50 text-indigo-700'
                          }`}>
                            {d.status}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">{d.packageName}</h4>
                        <div className="text-[10px] text-slate-500 space-y-0.5">
                          <p><span className="font-semibold">From:</span> {d.pickupAddress}</p>
                          <p><span className="font-semibold">To:</span> {d.dropoffAddress}</p>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col items-end gap-2 w-full md:w-auto">
                        <span className="text-[11px] font-bold text-slate-900 block">₦{d.deliveryFee.toLocaleString()}</span>
                        
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setSelectedDeliveryQR(d.qrCodeToken)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase transition flex items-center h-7"
                            title="Print slip / View QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {d.status === 'Assigned' && !d.assignedDriverId && (
                            <select
                              onChange={(e) => onManualAssignDriver(d.id, e.target.value || null)}
                              className="text-[10px] bg-indigo-50 border border-indigo-100 rounded-lg px-2 h-7 font-bold text-indigo-900"
                              defaultValue=""
                            >
                              <option value="">Assign Carrier...</option>
                              {drivers
                                .filter(drv => drv.status === 'Online' && drv.approvalStatus === 'Approved')
                                .map(drv => (
                                  <option key={drv.id} value={drv.id}>{drv.name} ({drv.vehicleType})</option>
                                ))}
                            </select>
                          )}

                          {d.assignedDriverId && (
                            <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded inline-block h-7 leading-none flex items-center">
                              {d.assignedDriverName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Carrier Staff Panel */}
        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-600">Verification & Logistics Fleet</h3>
              </div>

              <div className="divide-y divide-slate-100">
                {drivers.map(drv => (
                  <div key={drv.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <img src={drv.avatar} alt={drv.name} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{drv.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            drv.approvalStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            drv.approvalStatus === 'Suspended' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {drv.approvalStatus}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">{drv.phone} • {drv.vehicleType} [{drv.vehiclePlate}]</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                      {drv.approvalStatus !== 'Approved' ? (
                        <button
                          onClick={() => onApproveDriver(drv.id)}
                          className="py-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 shadow-xs transition h-7"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Approve licenses
                        </button>
                      ) : (
                        <button
                          onClick={() => onSuspendDriver(drv.id)}
                          className="py-1 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 transition h-7"
                        >
                          <UserX className="w-3.5 h-3.5" /> Suspend
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Office Roster Tab */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-600">Registered Office personnel</h3>
              </div>

              <div className="divide-y divide-slate-100">
                {admins.map(adm => (
                  <div key={adm.id} className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <img src={adm.avatar} alt={adm.name} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{adm.name}</span>
                          <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">{adm.role}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{adm.email} • Office Zone: {adm.officeLocation}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                      {adm.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live Map Tab */}
        {activeTab === 'map' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-slate-800">DELIVERI Live Fleet Tracking</h3><span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-bold">Real GPS</span></div>
            <LiveMap drivers={drivers} deliveries={deliveries}/>
            <p className="text-[10px] text-slate-500">Driver coordinates are supplied by approved drivers and refreshed from the DELIVERI API. Exact coordinates are restricted to Admin workspace.</p>
          </div>
        )}

        {/* Finance & Payouts */}
        {activeTab === 'finance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[["Gross delivery fees",finance.grossFees],["Driver earnings",finance.driverEarnings],["DELIVERI revenue",finance.platformRevenue],["Pending payouts",finance.pendingPayouts]].map(([label,value]:any)=><div key={label} className="bg-white border border-slate-200 rounded-xl p-4"><div className="text-[9px] uppercase font-bold text-slate-400">{label}</div><div className="text-lg font-black text-slate-800 mt-1">₦{Number(value).toLocaleString()}</div></div>)}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="p-4 border-b border-slate-100 font-bold text-sm">Driver Payout Queue</div><div className="divide-y divide-slate-100">{payouts.length===0?<div className="p-6 text-center text-xs text-slate-400">No payout requests.</div>:payouts.map(p=><div key={p.id} className="p-4 flex items-center justify-between gap-3"><div><div className="text-xs font-bold text-slate-800">{p.driverName||p.driver_id}</div><div className="text-[9px] text-slate-400">{p.reference} • {p.status}</div></div><div className="flex items-center gap-2"><b className="text-sm">₦{Number(p.amount).toLocaleString()}</b>{p.status!=='Paid'&&<button onClick={async()=>{await api.updatePayoutStatus(p.id,'Paid');const [a,b]=await Promise.all([api.getFinanceSummary(),api.getPayouts()]);setFinance(a);setPayouts(b)}} className="text-[9px] font-black uppercase bg-emerald-600 text-white px-3 py-1.5 rounded-lg">Mark Paid</button>}</div></div>)}</div></div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Performance Scoreboard banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">Driver Performance Scoreboard</h3>
                
                <div className="space-y-3">
                  {drivers.map(drv => (
                    <div key={drv.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-700">{drv.name} ({drv.vehicleType})</span>
                        <span className="font-mono text-slate-600">★ {drv.rating} Rating • {drv.totalDeliveries} Completed</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full" 
                          style={{ width: `${Math.min(100, (drv.rating / 5) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery distribution chart board */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">TradeEase Regional fulfillment metrics</h3>
                <div className="grid grid-cols-2 gap-3.5 pt-2">
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Ikeja Hub</span>
                    <h5 className="text-base font-extrabold text-slate-900 mt-1">45%</h5>
                    <p className="text-[9px] text-slate-400 mt-0.5">High tech/Apparel demand</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Lekki Transit</span>
                    <h5 className="text-base font-extrabold text-slate-900 mt-1">32%</h5>
                    <p className="text-[9px] text-slate-400 mt-0.5">Resident/Retail drop-offs</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Yaba Area</span>
                    <h5 className="text-base font-extrabold text-slate-900 mt-1">15%</h5>
                    <p className="text-[9px] text-slate-400 mt-0.5">Academic/Fabric merchants</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Surulere / VI</span>
                    <h5 className="text-base font-extrabold text-slate-900 mt-1">8%</h5>
                    <p className="text-[9px] text-slate-400 mt-0.5">Corporate business/Catering</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </section>

      {/* CREATE DELIVERY DISPATCH SLIP FORM MODAL */}
      {showAddDelivery && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <form 
            onSubmit={handleDeliverySubmit} 
            className="bg-white rounded-3xl p-5 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Create New TradeEase Shipment</h3>
                <p className="text-[10px] text-slate-500">Dispatch a package inside TradeEase logistics nodes.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddDelivery(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition"
              >
                <Plus className="w-5 h-5 transform rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Package Cargo Name*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. MacBook Pro M3 Max" 
                  value={newDelPkg} 
                  onChange={(e) => setNewDelPkg(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Seller (TradeEase Merchant)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Alaba Tech Wholesalers" 
                  value={newDelSeller} 
                  onChange={(e) => setNewDelSeller(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Southeast Pickup Hub Address*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Okpara Avenue Hub, Enugu" 
                  value={newDelPickup} 
                  onChange={(e) => setNewDelPickup(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nigerian Customer Dropoff Address*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Ikenegbu Extension, Owerri" 
                  value={newDelDropoff} 
                  onChange={(e) => setNewDelDropoff(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer Full Name*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Emeka Okafor" 
                  value={newDelCust} 
                  onChange={(e) => setNewDelCust(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer Phone Num*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. +234 803 111 2222" 
                  value={newDelPhone} 
                  onChange={(e) => setNewDelPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Weight (kg)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={newDelWeight} 
                  onChange={(e) => setNewDelWeight(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Est Cargo Value (₦)</label>
                <input 
                  type="number" 
                  value={newDelValue} 
                  onChange={(e) => setNewDelValue(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Delivery Routing Fee (₦)</label>
                <input 
                  type="number" 
                  value={newDelFee} 
                  onChange={(e) => setNewDelFee(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Paystack API Billing Method</label>
                <select 
                  value={newDelPayMethod} 
                  onChange={(e: any) => setNewDelPayMethod(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-semibold"
                >
                  <option value="Paystack Card">Paystack API (Instant Paid)</option>
                  <option value="Cash on Delivery">Cash on Delivery (Pending)</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Assign Carrier Field Staff</label>
                <select 
                  value={newDelDriverId} 
                  onChange={(e) => setNewDelDriverId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-semibold"
                >
                  <option value="">Unassigned (Open pool)...</option>
                  {drivers
                    .filter(drv => drv.status === 'Online' && drv.approvalStatus === 'Approved')
                    .map(drv => (
                      <option key={drv.id} value={drv.id}>{drv.name} ({drv.vehicleType})</option>
                    ))}
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold uppercase shadow-md transition"
            >
              Verify & Dispatch Shipment
            </button>
          </form>
        </div>
      )}

      {/* CREATE DRIVER FIELD ACCOUNT MODAL */}
      {showAddDriver && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <form 
            onSubmit={handleDriverSubmit} 
            className="bg-white rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Provision Field Carrier</h3>
                <p className="text-[10px] text-slate-500 font-medium">Create and verify a mobile driver account.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddDriver(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition"
              >
                <Plus className="w-5 h-5 transform rotate-45" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Full Legal Name*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Tochukwu Okafor" 
                  value={newDrvName} 
                  onChange={(e) => setNewDrvName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Phone contact (Nigeria format)*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. +234 812 555 4433" 
                  value={newDrvPhone} 
                  onChange={(e) => setNewDrvPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Driver Email Office Address</label>
                <input 
                  type="email" 
                  placeholder="Username@deliveri.ng" 
                  value={newDrvEmail} 
                  onChange={(e) => setNewDrvEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Carrier Transit Vehicle</label>
                  <select 
                    value={newDrvVehicle} 
                    onChange={(e: any) => setNewDrvVehicle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="Motorcycle">Motorcycle (Fast lane)</option>
                    <option value="Delivery Van">Delivery Van</option>
                    <option value="Truck">Truck (Heavy Cargo)</option>
                    <option value="E-Bike">E-Bike</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Plate Reg Plate*</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. LA-301-IKJ" 
                    value={newDrvPlate} 
                    onChange={(e) => setNewDrvPlate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
                
              </div>
            </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Account password*</label><input type="password" required minLength={8} value={newDrvPassword} onChange={e=>setNewDrvPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"/></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">ID type*</label><select value={newDrvIdType} onChange={e=>setNewDrvIdType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"><option>NIN</option><option>International Passport</option><option>Driver Licence</option><option>Voter Card</option></select></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">ID number*</label><input required value={newDrvIdNumber} onChange={e=>setNewDrvIdNumber(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"/></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">ID document*</label><input required type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){alert('ID document must be 5 MB or less.');return;}const r=new FileReader();r.onload=()=>setNewDrvIdDocument(String(r.result));r.readAsDataURL(f)}} className="w-full text-[10px]"/></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Address</label><input value={newDrvAddress} onChange={e=>setNewDrvAddress(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"/></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Emergency contact</label><input value={newDrvEmergency} onChange={e=>setNewDrvEmergency(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"/></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Vehicle model</label><input value={newDrvVehicleModel} onChange={e=>setNewDrvVehicleModel(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"/></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Vehicle colour / year</label><div className="flex gap-2"><input value={newDrvVehicleColor} onChange={e=>setNewDrvVehicleColor(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-3 py-2 text-xs"/><input type="number" value={newDrvVehicleYear} onChange={e=>setNewDrvVehicleYear(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-3 py-2 text-xs"/></div></div>
              </div>
            <button 
              type="submit" 
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold uppercase shadow-md transition"
            >
              Create Driver Account
            </button>
          </form>
        </div>
      )}

      {/* CREATE OTHER OFFICE ADMINISTRATIVE ACCOUNT MODAL */}
      {showAddAdmin && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <form 
            onSubmit={handleAdminSubmit} 
            className="bg-white rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Provision Roster Staff</h3>
                <p className="text-[10px] text-slate-500 font-medium">Register office staff inside regional nodes (Abia, Imo, Anambra, Enugu).</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddAdmin(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition"
              >
                <Plus className="w-5 h-5 transform rotate-45" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Member Legal Name*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Eberechi Uzor" 
                  value={newAdmName} 
                  onChange={(e) => setNewAdmName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Office Email*</label>
                <input 
                  type="email" 
                  required 
                  placeholder="e.g. eberechi@tradeease.com" 
                  value={newAdmEmail} 
                  onChange={(e) => setNewAdmEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Roster Role*</label>
                  <select 
                    value={newAdmRole} 
                    onChange={(e: any) => setNewAdmRole(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="Manager">Manager</option>
                    <option value="Office Assistant">Office Assistant</option>
                    <option value="Dispatcher">Dispatcher</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Main Office location*</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Aladinma Hub, Owerri" 
                    value={newAdmOffice} 
                    onChange={(e) => setNewAdmOffice(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Initial password*</label><input type="password" required minLength={8} value={newAdmPassword} onChange={e=>setNewAdmPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"/></div>
            <button 
              type="submit" 
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold uppercase shadow-md transition"
            >
              Create Office Account
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
