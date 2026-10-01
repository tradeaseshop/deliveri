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
import { motion, AnimatePresence } from 'motion/react';

// Models
import { Delivery, DriverAccount, AdminAccount, EarningsRecord, NotificationItem, UserRole } from './types';
import * as api from './api';

// Custom sub-components
import DriverDevice from './components/DriverDevice';
import AdminDevice from './components/AdminDevice';

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
  const [showSplash, setShowSplash] = useState(true);
  const [currentFlow, setCurrentFlow] = useState<'role_selection' | 'login' | 'signup' | 'forgot_password' | 'reset_password' | 'workspace'>('role_selection');
  
  // Selected roles during login setup
  const [selectedRoleReg, setSelectedRoleReg] = useState<UserRole>('DRIVER');
  const [loggedInRole, setLoggedInRole] = useState<UserRole>('ADMIN');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  
  // Auth Form details
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPlate, setAuthPlate] = useState('');
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

  // Workspace simulation controls
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
    const splashTimer = setTimeout(() => setShowSplash(false), 2800);

    (async () => {
      const urlToken = new URLSearchParams(window.location.search).get('token');
      if (urlToken) { setResetToken(urlToken); setCurrentFlow('reset_password'); return; }
      const token = api.getToken();
      if (!token) {
        setCurrentFlow('role_selection');
        return;
      }
      try {
        const me = await api.getMe();
        if (me.role === 'admin') {
          setLoggedInRole('ADMIN');
          setCurrentUserId(me.admin!.id);
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

    return () => clearTimeout(splashTimer);
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
      if(result.admin) setCurrentUserId(result.admin.id);
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

  // Wipes and re-seeds the shared database back to its original sample data,
  // then signs everyone (including this admin) out, since accounts get
  // recreated with fresh ids.
  const handleFullReset = async () => {
    try {
      await api.resetDemoData();
      api.logout();
      setDeliveries([]);
      setDrivers([]);
      setAdmins([]);
      setEarnings([]);
      setNotifications([]);
      setCurrentFlow('role_selection');
      playAlertChime('success');
      setSuccessMsg('TradeEase Logistics database reset to its original sample data. Please log back in.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e: any) {
      setSuccessMsg(null);
      console.error('Error resetting demo data:', e);
      playAlertChime('action');
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

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!authEmail || !authName || !authPhone) {
      setAuthError('Please fill in required legal verification fields.');
      return;
    }
    if (!authPassword || authPassword.length < 5) {
      setAuthError('Please choose a password of at least 5 characters.');
      return;
    }

    setAuthLoading(true);
    try {
      await api.driverSignup({
        name: authName,
        phone: authPhone,
        email: authEmail.trim().toLowerCase(),
        password: authPassword,
        vehicleType: 'Motorcycle',
        vehiclePlate: authPlate || 'LA-707-IKJ',
      });
      setSuccessMsg(`Welcome to TradeEase Logistics, ${authName}! Your carrier license is pending verification.`);
      // Signup logs the new account in automatically on the backend; sign back
      // out here so the person confirms their credentials via the login screen.
      api.logout();
      setTimeout(() => setSuccessMsg(null), 4000);
      setAuthPassword('');
      setCurrentFlow('login');
    } catch (err: any) {
      setAuthError(err.message || 'Signup failed. Please try again.');
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

  const handleAddNewDriver = async (d: Omit<DriverAccount, 'id' | 'totalDeliveries' | 'earnings' | 'rating' | 'approvalStatus'>) => {
    try {
      const created = await api.addDriver(d);
      setDrivers(prev => [created, ...prev]);
      playAlertChime('success');
    } catch (e) {
      console.error('Error adding driver:', e);
    }
  };

  const handleAddNewAdmin = async (a: Omit<AdminAccount, 'id' | 'status'>) => {
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

  const handleLogout = () => {
    api.logout();
    setCurrentFlow('role_selection');
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans flex flex-col overflow-x-hidden relative text-brand-text transition-colors duration-300">
      
      {/* Dynamic Animated Splash Screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            id="splash-screen"
            className="fixed inset-0 bg-brand-bg flex flex-col items-center justify-center z-50 text-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8, type: 'spring' }}
              className="space-y-4"
            >
              <div className="h-20 w-20 bg-brand-primary rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(149,195,50,0.4)] border border-brand-accent">
                <Truck className="w-10 h-10 text-brand-surface animate-bounce" />
              </div>
              <h1 className="text-4xl font-black tracking-widest text-brand-text font-display">DELIVERI</h1>
              <p className="text-xs text-brand-muted font-mono tracking-wider">Premium TradeEase Logistics Suite</p>
            </motion.div>
            
            <div className="absolute bottom-10 w-full text-center flex flex-col items-center gap-2">
              <span className="text-[10px] text-brand-primary font-bold border border-brand-primary/30 px-3 py-1 rounded-full bg-brand-surface/40">Secure Node Online</span>
              <div className="h-1 w-32 bg-brand-surface/20 rounded-full overflow-hidden">
                <div className="bg-brand-primary h-full w-2/3 rounded-full animate-pulse"></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main flow handlers */}
      {!showSplash && (
        <>
          {currentFlow === 'role_selection' && (
            <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg text-brand-text transition-colors duration-300">
              <div className="max-w-md w-full bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-6 transition-colors duration-300">
                <div className="text-center space-y-2">
                  <div className="h-14 w-14 bg-brand-primary rounded-2xl mx-auto flex items-center justify-center border border-brand-accent">
                    <Truck className="w-7 h-7 text-brand-surface" />
                  </div>
                  <h2 className="text-2xl font-black text-brand-text font-display">DELIVERI</h2>
                  <p className="text-xs text-brand-muted">TradeEase Multivendor Logistics Network</p>
                </div>

                <div className="space-y-3 pt-4">
                  <button
                    onClick={() => {
                      setSelectedRoleReg('DRIVER');
                      setCurrentFlow('login');
                    }}
                    className="w-full bg-brand-primary hover:bg-brand-primary-hover text-brand-surface font-extrabold py-3.5 rounded-2xl transition shadow-md flex items-center justify-between px-6 cursor-pointer"
                  >
                    <span className="text-sm">Driver Login</span>
                    <Smartphone className="w-5 h-5 opacity-80" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRoleReg('ADMIN');
                      setCurrentFlow('login');
                    }}
                    className="w-full bg-brand-surface hover:bg-brand-surface-hover text-brand-text font-extrabold py-3.5 rounded-2xl transition border border-brand-border flex items-center justify-between px-6 cursor-pointer"
                  >
                    <span className="text-sm">Admin Control Panel</span>
                    <ShieldCheck className="w-5 h-5 opacity-80 text-brand-primary" />
                  </button>
                </div>

                <div className="pt-4 border-t border-brand-border/60 text-center">
                  <button 
                    onClick={() => {
                      setSelectedRoleReg('DRIVER');
                      setCurrentFlow('signup');
                    }}
                    className="text-xs text-brand-primary hover:underline inline-flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <UserPlus className="w-4 h-4" /> Apply as TradeEase Driver
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentFlow === 'login' && (
            <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg text-brand-text transition-colors duration-300">
              <div className="max-w-sm w-full bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-2xl space-y-5 transition-colors duration-300">
                <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
                  <div>
                    <h3 className="text-lg font-extrabold text-brand-text font-display">
                      {selectedRoleReg === 'DRIVER' ? 'Driver Login' : 'Admin Portal'}
                    </h3>
                    <p className="text-[10px] text-brand-primary uppercase tracking-widest font-bold">TradeEase Logistics Sec</p>
                  </div>
                  <button 
                    onClick={() => setCurrentFlow('role_selection')} 
                    className="text-xs text-brand-muted hover:text-brand-text transition cursor-pointer font-bold"
                  >
                    Back
                  </button>
                </div>

                {authError && (
                  <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 flex-shrink-0" />
                    <p>{authError}</p>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-muted uppercase">Verification Email*</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-brand-muted/80" />
                      <input 
                        type="email" 
                        required 
                        placeholder={selectedRoleReg === 'DRIVER' ? 'efe.johnson@deliveri.ng' : 'tunde@tradeease.com'} 
                        value={authEmail} 
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-text focus:outline-hidden focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-brand-muted uppercase">Secure Password*</label>
                      <button 
                        type="button" 
                        onClick={() => setCurrentFlow('forgot_password')}
                        className="text-[10px] text-brand-primary hover:underline font-bold"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-brand-muted/80" />
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        required 
                        placeholder="••••••••" 
                        value={authPassword} 
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pl-10 pr-10 text-xs text-brand-text focus:outline-hidden focus:border-brand-primary"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-brand-muted hover:text-brand-text"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={authLoading}
                    className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-brand-surface rounded-xl text-xs font-black uppercase shadow-md transition-all pt-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {authLoading ? 'Verifying...' : 'Onboard Verification credentials'}
                  </button>
                </form>

                <div className="text-center pt-3 border-t border-brand-border/60">
                  <p className="text-[11px] text-brand-muted">
                    Don't have an account?{' '}
                    <button onClick={() => setCurrentFlow('signup')} className="text-brand-primary font-bold hover:underline cursor-pointer">
                      Signup
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentFlow === 'signup' && (
            <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg text-brand-text transition-colors duration-300">
              <div className="max-w-sm w-full bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-2xl space-y-4 transition-colors duration-300">
                <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
                  <div>
                    <h3 className="text-lg font-bold text-brand-text font-display">Apply to Fleet</h3>
                    <p className="text-[10px] text-brand-muted">Join TradeEase Logistics as a driver</p>
                  </div>
                  <button onClick={() => setCurrentFlow('login')} className="text-xs text-brand-muted hover:text-brand-text transition font-bold cursor-pointer">Back</button>
                </div>

                <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-muted uppercase">Legal Full Name*</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Samuel Adebiyi" 
                      value={authName} 
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl p-2 text-xs text-brand-text focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-muted uppercase">Verify Email address*</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="samuel@tradeease.com" 
                      value={authEmail} 
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl p-2 text-xs text-brand-text focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-muted uppercase">Choose a Password*</label>
                    <input 
                      type="password" 
                      required 
                      minLength={5}
                      placeholder="At least 5 characters" 
                      value={authPassword} 
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl p-2 text-xs text-brand-text focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-muted uppercase">Nigerian Mobile Phone No*</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="+234 803 765 4321" 
                      value={authPhone} 
                      onChange={(e) => setAuthPhone(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl p-2 text-xs text-brand-text focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-muted uppercase">Motorcycle / Van plate*</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="LA-774-APP" 
                      value={authPlate} 
                      onChange={(e) => setAuthPlate(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl p-2 text-xs text-brand-text font-mono focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={authLoading}
                    className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-brand-surface rounded-xl text-xs font-black uppercase transition shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {authLoading ? 'Submitting...' : 'Onboard applicant slot'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {currentFlow === 'reset_password' && (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg p-5">
              <form onSubmit={async e=>{e.preventDefault(); if(authPassword.length<8||authPassword!==resetConfirm){setAuthError('Passwords must match and be at least 8 characters.');return;} try{await api.resetPassword(resetToken,authPassword);setSuccessMsg('Password reset successfully. You can now log in.');window.history.replaceState({},'',window.location.pathname);setCurrentFlow('login');}catch(err:any){setAuthError(err.message||'Password reset failed.')}}} className="w-full max-w-sm bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-xl">
                <h2 className="text-lg font-black text-brand-text">Create a new password</h2><p className="text-xs text-brand-muted mt-1 mb-5">Choose a strong password for your DELIVERI account.</p>
                <input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="New password" className="w-full p-3 rounded-xl border border-brand-border bg-brand-bg text-brand-text mb-3" minLength={8}/>
                <input type="password" value={resetConfirm} onChange={e=>setResetConfirm(e.target.value)} placeholder="Confirm new password" className="w-full p-3 rounded-xl border border-brand-border bg-brand-bg text-brand-text mb-4" minLength={8}/>
                {authError&&<div className="text-xs text-red-500 mb-3">{authError}</div>}<button className="w-full py-3 rounded-xl bg-brand-primary text-brand-surface font-black uppercase text-xs">Reset Password</button>
              </form>
            </div>
          )}

          {currentFlow === 'forgot_password' && (
            <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg text-brand-text transition-colors duration-300">
              <div className="max-w-sm w-full bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-2xl space-y-4 transition-colors duration-300">
                <div className="border-b border-brand-border/60 pb-2">
                  <h3 className="text-lg font-bold text-brand-text font-display">Credential Reset Request</h3>
                  <p className="text-[10px] text-brand-muted">TradeEase Administrative recovery channel</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-muted uppercase">Associated email address</label>
                  <input 
                    type="email" 
                    placeholder="tunde@tradeease.com" 
                    value={forgotEmail} 
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl p-2 text-xs text-brand-text focus:outline-hidden focus:border-brand-primary"
                  />
                </div>

                <div className="flex gap-2.5">
                  <button
                    onClick={async () => {
                      try { await api.requestPasswordReset(forgotEmail); setSuccessMsg('If that email has a DELIVERI account, a secure password reset link has been sent.'); setTimeout(()=>setSuccessMsg(null),6000); setCurrentFlow('login'); }
                      catch(e:any){setAuthError(e?.message||'Password recovery failed');}
                    }}
                    className="flex-1 py-2 bg-brand-primary hover:bg-brand-primary-hover text-brand-surface rounded-xl text-xs font-extrabold uppercase transition cursor-pointer"
                  >
                    Send Reset Link
                  </button>
                  <button
                    onClick={() => setCurrentFlow('login')}
                    className="flex-1 py-2 bg-brand-surface hover:bg-brand-surface-hover text-brand-text border border-brand-border rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

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
                <div className="text-[10px] font-black tracking-widest uppercase text-brand-muted">DELIVERI • {loggedInRole === 'ADMIN' ? 'Admin Workspace' : 'Driver Workspace'}</div>
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
                      onAddDelivery={handleAddNewDelivery}
                      onAddDriver={handleAddNewDriver}
                      onAddAdmin={handleAddNewAdmin}
                      onApproveDriver={handleApproveDriver}
                      onSuspendDriver={handleSuspendDriver}
                      onManualAssignDriver={handleManualAssign}
                      onLogout={handleLogout}
                      darkMode={darkMode}
                      onToggleDarkMode={() => setDarkMode(!darkMode)}
                      onResetDemo={handleFullReset}
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
