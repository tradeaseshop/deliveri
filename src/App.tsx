/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  Users, 
  MapPin, 
  QrCode, 
  Compass, 
  CheckCircle, 
  ShieldCheck, 
  Volume2, 
  RefreshCw,
  Bell,
  Lock,
  Mail,
  UserPlus,
  Eye,
  EyeOff,
  Briefcase,
  Smartphone,
  Globe,
  Plus,
  Compass as CompassIcon,
  HelpCircle,
  X
} from 'lucide-react';

// Models
import { Delivery, DriverAccount, AdminAccount, EarningsRecord, NotificationItem, UserRole } from './types';
import * as api from './api';

// Custom sub-components
import DriverDevice from './components/DriverDevice';
import AdminDevice from './components/AdminDevice';
import ProfilePanel from './components/ProfilePanel';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const cached = localStorage.getItem('deliveri_theme');
    return cached ? cached === 'dark' : true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
    }
    localStorage.setItem('deliveri_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Splash and Screen flow states
  const [currentFlow, setCurrentFlow] = useState<'role_selection' | 'login' | 'forgot_password' | 'reset_password' | 'workspace'>('role_selection');
  
  // Selected roles during login setup
  const [selectedRoleReg, setSelectedRoleReg] = useState<UserRole>('DRIVER');
  const [loggedInRole, setLoggedInRole] = useState<UserRole>('ADMIN');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [profileAccount, setProfileAccount] = useState<AdminAccount | DriverAccount | null>(null);
  const [currentAdminRole, setCurrentAdminRole] = useState<AdminAccount['role'] | null>(null);
  
  // Auth Form details
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');

  // Live datastores, now backed by the REST API instead of localStorage
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<DriverAccount[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [earnings, setEarnings] = useState<EarningsRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [activeDriverId, setActiveDriverId] = useState<string>('');

  // Loads whatever data the current role is allowed to see. Called after
  // login and then polled periodically so the workspace feels live.
  const loadWorkspaceData = useCallback(async (role: UserRole) => {
    try {
      if (role === 'ADMIN') {
        const [del, drv, adm, earn, notif] = await Promise.all([
          api.getDeliveries(),
          api.getDrivers(),
          api.getAdmins(),
          api.getEarnings(),
          api.getNotifications(),
        ]);
        setDeliveries(del);
        setDrivers(drv);
        setAdmins(adm);
        setEarnings(earn);
        setNotifications(notif);
      } else {
        const [del, earn, notif, me] = await Promise.all([
          api.getDeliveries(),
          api.getEarnings(),
          api.getNotifications(),
          api.getMe(),
        ]);
        setDeliveries(del);
        setEarnings(earn);
        setNotifications(notif);
        if (me.driver) setDrivers([me.driver]);
      }
    } catch (e) {
      console.error('Error loading workspace data:', e);
    }
  }, []);

  // Restore a saved session on load, then poll for freshness while in the workspace.
  useEffect(() => {
    (async () => {
      const urlToken = new URLSearchParams(window.location.search).get('token');
      if (urlToken) { setResetToken(urlToken); setCurrentFlow('reset_password'); return; }
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (path === '/admin') setSelectedRoleReg('ADMIN');
      else if (path === '/driver') setSelectedRoleReg('DRIVER');
      const token = api.getToken();
      if (!token) { setCurrentFlow(path === '/admin' || path === '/driver' ? 'login' : 'role_selection'); return; }
      try {
        const me = await api.getMe();
        const requested = window.location.pathname.replace(/\/+$/, '') || '/';
        if ((requested === '/driver' && me.role !== 'driver') || (requested === '/admin' && me.role !== 'admin')) {
          api.logout(); setCurrentFlow('login'); return;
        }
        if (me.role === 'admin') {
          setLoggedInRole('ADMIN');
          setCurrentUserId(me.admin!.id);
          setCurrentAdminRole(me.admin!.role);
          setAvailableRoles(me.availableRoles || ['admin']);
        } else {
          setLoggedInRole('DRIVER');
          setCurrentUserId(me.driver!.id);
          setActiveDriverId(me.driver!.id);
          setAvailableRoles(me.availableRoles || ['driver']);
        }
        setCurrentFlow('workspace');
      } catch {
        api.logout();
        setCurrentFlow('role_selection');
      }
    })();
  }, []);

  useEffect(() => {
    if (currentFlow !== 'workspace') return;
    loadWorkspaceData(loggedInRole);
    const interval = setInterval(() => loadWorkspaceData(loggedInRole), 8000);
    return () => clearInterval(interval);
  }, [currentFlow, loggedInRole, loadWorkspaceData]);

  // Real driver GPS: only while logged in as Driver and only while the browser grants permission.
  useEffect(() => {
    if (currentFlow !== 'workspace' || loggedInRole !== 'DRIVER' || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      pos => api.setMyLocation(pos.coords.latitude, pos.coords.longitude).catch(()=>{}),
      err => console.warn('[DELIVERI GPS]', err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [currentFlow, loggedInRole]);

  const handleWorkspaceSwitch = async (target:'admin'|'driver') => {
    try {
      const result=await api.switchRole(target); localStorage.setItem('deliveri_token',result.token);
      setLoggedInRole(target==='admin'?'ADMIN':'DRIVER');
      if(result.admin) {setCurrentUserId(result.admin.id);setCurrentAdminRole(result.admin.role);}
      if(result.driver){setCurrentUserId(result.driver.id);setActiveDriverId(result.driver.id);}
      setAvailableRoles(result.availableRoles||availableRoles);
      await loadWorkspaceData(target==='admin'?'ADMIN':'DRIVER');
    } catch(e:any){setAuthError(e?.message||'Workspace switch failed');}
  };

  // Audio Event Chime Synthesizer
  const playAlertChime = (type: 'notification' | 'action' | 'success') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'notification') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      console.log('Audio Context suppressed by browser policies', e);
    }
  };

  // Auth Handling
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!authEmail || !authPassword) {
      setAuthError('Please fill in email and password.');
      return;
    }

    setAuthLoading(true);
    try {
      if (selectedRoleReg === 'ADMIN') {
        const admin = await api.adminLogin(authEmail.trim().toLowerCase(), authPassword);
        setLoggedInRole('ADMIN');
        setCurrentUserId(admin.id);
        setCurrentAdminRole(admin.role);
        setAvailableRoles(['admin']);
        try { const me=await api.getMe(); setAvailableRoles(me.availableRoles||['admin']); } catch {}
        setCurrentFlow('workspace');
        playAlertChime('success');
      } else {
        const driver = await api.driverLogin(authEmail.trim().toLowerCase(), authPassword);
        setLoggedInRole('DRIVER');
        setCurrentUserId(driver.id);
        setActiveDriverId(driver.id);
        setAvailableRoles(['driver']);
        try { const me=await api.getMe(); setAvailableRoles(me.availableRoles||['driver']); } catch {}
        setCurrentFlow('workspace');
        playAlertChime('success');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  // LOGISTICS MUTATION PROCEDURES (Synced Real-Time)
  const handleAddNewDelivery = async (d: Omit<Delivery, 'id' | 'trackingNumber' | 'createdAt' | 'qrCodeToken' | 'status'>) => {
    try {
      const created = await api.createDelivery(d);
      setDeliveries(prev => [created, ...prev]);
      if (d.assignedDriverId) playAlertChime('notification');
    } catch (e) {
      console.error('Error creating delivery:', e);
    }
  };

  const handleAddNewDriver = async (d: any) => {
    try {
      const created = await api.addDriver(d);
      setDrivers(prev => [created, ...prev]);
      playAlertChime('success');
    } catch (e) {
      console.error('Error adding driver:', e);
    }
  };

  const handleAddNewAdmin = async (a: any) => {
    try {
      const created = await api.addAdmin(a);
      setAdmins(prev => [created, ...prev]);
      playAlertChime('success');
    } catch (e) {
      console.error('Error adding admin:', e);
    }
  };

  const handleApproveDriver = async (id: string) => {
    try {
      const updated = await api.approveDriver(id);
      setDrivers(prev => prev.map(d => (d.id === id ? updated : d)));
      playAlertChime('success');
    } catch (e) {
      console.error('Error approving driver:', e);
    }
  };

  const handleSuspendDriver = async (id: string) => {
    try {
      const updated = await api.suspendDriver(id);
      setDrivers(prev => prev.map(d => (d.id === id ? updated : d)));
      playAlertChime('action');
    } catch (e) {
      console.error('Error suspending driver:', e);
    }
  };

  const handleManualAssign = async (deliveryId: string, driverId: string | null) => {
    try {
      const updated = await api.assignDelivery(deliveryId, driverId);
      setDeliveries(prev => prev.map(d => (d.id === deliveryId ? updated : d)));
      if (driverId) playAlertChime('notification');
    } catch (e) {
      console.error('Error assigning delivery:', e);
    }
  };

  // Driver Status and Completion updates
  const handleUpdateDeliveryStatus = async (id: string, status: Delivery['status']) => {
    try {
      const updated = await api.updateDeliveryStatus(id, status as 'Picked Up' | 'In Transit' | 'Delivered');
      setDeliveries(prev => prev.map(d => (d.id === id ? updated : d)));
      if (status === 'Delivered') {
        // Refresh driver stats (earnings/total deliveries) and the earnings ledger.
        const [me, earn] = await Promise.all([api.getMe(), api.getEarnings()]);
        if (me.driver) setDrivers(prev => prev.map(d => (d.id === me.driver!.id ? me.driver! : d)));
        setEarnings(earn);
        playAlertChime('success');
      } else {
        playAlertChime('action');
      }
    } catch (e) {
      console.error('Error updating delivery status:', e);
    }
  };

  const handleUpdateDriverActiveStatus = async (isOnline: boolean) => {
    try {
      const updated = await api.setMyDriverStatus(isOnline);
      setDrivers(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      playAlertChime('action');
    } catch (e) {
      console.error('Error updating driver status:', e);
    }
  };

  const handleAcceptDelivery = async (id: string) => {
    try {
      const updated = await api.acceptDelivery(id);
      setDeliveries(prev => prev.map(d => (d.id === id ? updated : d)));
      playAlertChime('success');
    } catch (e) {
      console.error('Error accepting delivery:', e);
    }
  };

  const handleRejectDelivery = async (id: string, reason: string) => {
    try {
      const updated = await api.rejectDelivery(id, reason);
      setDeliveries(prev => prev.map(d => (d.id === id ? updated : d)));
      playAlertChime('action');
    } catch (e) {
      console.error('Error rejecting delivery:', e);
    }
  };

  const handleLogout = () => { api.logout(); setProfileAccount(null); window.location.href = loggedInRole === 'DRIVER' ? '/driver' : '/admin'; };

  return (
    <div className="min-h-screen bg-brand-bg font-sans flex flex-col overflow-x-hidden relative text-brand-text transition-colors duration-300">
      
      {/* Authentication */}
      {currentFlow === 'role_selection' && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg"><div className="max-w-md w-full bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-2xl space-y-6"><div className="text-center space-y-2"><div className="h-14 w-14 bg-brand-primary rounded-2xl mx-auto flex items-center justify-center"><Truck className="w-7 h-7 text-brand-surface"/></div><h1 className="text-2xl font-black">DELIVERI</h1><p className="text-xs text-brand-muted">Logistics operations platform</p></div><div className="grid gap-3"><button onClick={()=>{setSelectedRoleReg('DRIVER');window.history.pushState({},'', '/driver');setCurrentFlow('login')}} className="w-full bg-brand-primary text-brand-surface font-black py-3.5 rounded-2xl flex items-center justify-between px-5"><span>Driver Login</span><Smartphone className="w-5 h-5"/></button><button onClick={()=>{setSelectedRoleReg('ADMIN');window.history.pushState({},'', '/admin');setCurrentFlow('login')}} className="w-full bg-brand-surface text-brand-text font-black py-3.5 rounded-2xl border border-brand-border flex items-center justify-between px-5"><span>Admin Login</span><ShieldCheck className="w-5 h-5 text-brand-primary"/></button></div></div></div>
      )}
      {currentFlow === 'login' && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg"><div className="max-w-sm w-full bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-2xl space-y-5"><div className="flex justify-between items-center pb-3 border-b border-brand-border"><div><h2 className="text-lg font-black">{selectedRoleReg==='DRIVER'?'Driver Login':'Admin Login'}</h2><p className="text-[10px] text-brand-muted">DELIVERI operations</p></div><button onClick={()=>window.location.href='/'} className="text-xs text-brand-muted font-bold">Back</button></div>{authError&&<div className="bg-rose-950/70 border border-rose-800 text-rose-300 p-2.5 rounded-xl text-xs">{authError}</div>}<form onSubmit={handleLoginSubmit} className="space-y-4"><label className="block space-y-1"><span className="text-[10px] font-bold text-brand-muted uppercase">Email address</span><div className="relative"><Mail className="absolute left-3 top-3 w-4 h-4 text-brand-muted"/><input autoFocus type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder={selectedRoleReg==='DRIVER'?'driver@deliveri.ng':'admin@deliveri.ng'} className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pl-10 pr-3 text-xs"/></div></label><label className="block space-y-1"><div className="flex justify-between"><span className="text-[10px] font-bold text-brand-muted uppercase">Password</span><button type="button" onClick={()=>setCurrentFlow('forgot_password')} className="text-[10px] text-brand-primary font-bold">Forgot password?</button></div><div className="relative"><Lock className="absolute left-3 top-3 w-4 h-4 text-brand-muted"/><input type={showPassword?'text':'password'} required value={authPassword} onChange={e=>setAuthPassword(e.target.value)} className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pl-10 pr-10 text-xs"/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-3 text-brand-muted">{showPassword?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button></div></label><button disabled={authLoading} className="w-full py-3 bg-brand-primary text-brand-surface rounded-xl text-xs font-black uppercase disabled:opacity-60">{authLoading?'Signing in...':'Sign in'}</button></form><p className="text-[10px] text-brand-muted text-center">New staff and driver accounts are created by authorised DELIVERI administrators.</p></div></div>
      )}
      {currentFlow === 'reset_password' && (<div className="min-h-screen flex items-center justify-center bg-brand-bg p-5"><form onSubmit={async e=>{e.preventDefault();if(authPassword.length<8||authPassword!==resetConfirm){setAuthError('Passwords must match and be at least 8 characters.');return;}try{await api.resetPassword(resetToken,authPassword);window.history.replaceState({},'',window.location.pathname);setCurrentFlow('login')}catch(err:any){setAuthError(err.message||'Password reset failed.')}}} className="w-full max-w-sm bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-xl space-y-3"><h2 className="text-lg font-black">Set new password</h2><input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="New password" minLength={8} className="w-full p-3 rounded-xl border border-brand-border bg-brand-bg"/><input type="password" value={resetConfirm} onChange={e=>setResetConfirm(e.target.value)} placeholder="Confirm password" minLength={8} className="w-full p-3 rounded-xl border border-brand-border bg-brand-bg"/>{authError&&<p className="text-xs text-red-500">{authError}</p>}<button className="w-full py-3 rounded-xl bg-brand-primary text-brand-surface font-black text-xs">Save password</button></form></div>)}
      {currentFlow === 'forgot_password' && (<div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg"><div className="max-w-sm w-full bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-2xl space-y-4"><h2 className="text-lg font-black">Reset password</h2><p className="text-xs text-brand-muted">Enter your DELIVERI account email.</p><input type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-xs"/><div className="flex gap-2"><button onClick={async()=>{try{await api.requestPasswordReset(forgotEmail);setSuccessMsg('If an account exists, a reset link has been sent.');setCurrentFlow('login')}catch(e:any){setAuthError(e.message)}}} className="flex-1 py-2 bg-brand-primary text-brand-surface rounded-xl text-xs font-black">Send link</button><button onClick={()=>setCurrentFlow('login')} className="flex-1 py-2 border border-brand-border rounded-xl text-xs font-bold">Cancel</button></div>{authError&&<p className="text-xs text-red-500">{authError}</p>}</div></div>)}

          {/* SINGLE VIEW CONCENTRIC WORKSPACE - Render based on logged-in credential role */}
          {currentFlow === 'workspace' && (
            <div className="min-h-screen flex flex-col h-screen overflow-hidden bg-brand-bg text-brand-text transition-colors duration-300">
              
              {/* Dynamic Action notifications */}
              {successMsg && (
                <div className="bg-brand-surface/90 border border-brand-primary text-brand-text text-xs px-4 py-2 block text-center font-bold z-50 shadow-md transition-colors animate-pulse">
                  ● STATUS: {successMsg}
                </div>
              )}

              {/* Secure workspace switcher */}
              <div className="h-11 shrink-0 bg-brand-surface border-b border-brand-border flex items-center justify-between px-4 z-40">
                <div className="text-[10px] font-black tracking-widest uppercase text-brand-muted">DELIVERI • {loggedInRole === 'ADMIN' ? 'Admin Workspace' : 'Driver Workspace'}</div><button onClick={async()=>{try{const me=await api.getMe();setProfileAccount(me.admin||me.driver||null)}catch{setAuthError('Unable to load profile.')}}} className="px-3 py-1.5 rounded-lg border border-brand-border text-[9px] font-black uppercase">My Profile</button>
                {availableRoles.length > 1 && <div className="flex items-center gap-1 bg-brand-bg rounded-lg p-1">{availableRoles.map(r=><button key={r} onClick={()=>handleWorkspaceSwitch(r as 'admin'|'driver')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase ${((r==='admin'&&loggedInRole==='ADMIN')||(r==='driver'&&loggedInRole==='DRIVER'))?'bg-brand-primary text-brand-surface':'text-brand-muted hover:text-brand-text'}`}>{r}</button>)}</div>}
              </div>

              {/* Main Workspace Frame */}
              <div className="flex-1 flex overflow-hidden relative">
                
                {/* Admin Screen Panel */}
                {loggedInRole === 'ADMIN' && (
                  <div className="flex-1 overflow-auto h-full">
                    <AdminDevice 
                      deliveries={deliveries}
                      drivers={drivers}
                      admins={admins}
                      currentAdminRole={currentAdminRole}
                      onAddDelivery={handleAddNewDelivery}
                      onAddDriver={handleAddNewDriver}
                      onAddAdmin={handleAddNewAdmin}
                      onApproveDriver={handleApproveDriver}
                      onSuspendDriver={handleSuspendDriver}
                      onManualAssignDriver={handleManualAssign}
                      onLogout={handleLogout}
                      darkMode={darkMode}
                      onToggleDarkMode={() => setDarkMode(!darkMode)}
                    />
                  </div>
                )}

                {/* Driver Screen Panel */}
                {loggedInRole === 'DRIVER' && (
                  <div className="flex-1 overflow-auto h-full">
                    {drivers.find(d => d.id === activeDriverId) ? (
                      <DriverDevice 
                        deliveries={deliveries}
                        driver={drivers.find(d => d.id === activeDriverId)!}
                        earnings={earnings}
                        notifications={notifications}
                        onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
                        onUpdateDriverStatus={handleUpdateDriverActiveStatus}
                        onAcceptDelivery={handleAcceptDelivery}
                        onRejectDelivery={handleRejectDelivery}
                        onLogout={handleLogout}
                        darkMode={darkMode}
                        onToggleDarkMode={() => setDarkMode(!darkMode)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-xs h-full w-full">
                        <p className="text-brand-muted text-sm mb-4">Driver account profile does not exist.</p>
                        <button 
                          onClick={handleLogout} 
                          className="px-4 py-2 bg-brand-primary text-brand-surface rounded-xl font-bold cursor-pointer hover:bg-brand-primary-hover transition"
                        >
                          Return to Login
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {profileAccount && <ProfilePanel account={profileAccount} onClose={()=>setProfileAccount(null)} onSaved={(updated)=>{setProfileAccount(updated);if(loggedInRole==='ADMIN')setAdmins(prev=>prev.map(a=>a.id===updated.id?updated as AdminAccount:a));else setDrivers(prev=>prev.map(d=>d.id===updated.id?updated as DriverAccount:d));}}/>}
            </div>
          )}
    </div>
  );
}
