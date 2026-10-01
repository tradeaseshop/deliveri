/**
 * REST API client for the DELIVERI backend (backend/), which replaces the
 * previous browser-localStorage data layer. All requests go to /api/* on
 * the same origin (see server.ts).
 */
import { AdminAccount, DriverAccount, Delivery, EarningsRecord, NotificationItem } from './types';

const TOKEN_KEY = 'deliveri_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed: ${res.status}`);
  }
  return data as T;
}

// ---------- Auth ----------

export async function driverSignup(input: { name: string; email: string; phone: string; password: string; vehicleType: string; vehiclePlate: string }) {
  const { token, driver } = await request<{ token: string; driver: DriverAccount }>('/auth/driver/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setToken(token);
  return driver;
}

export async function driverLogin(email: string, password: string) {
  const { token, driver } = await request<{ token: string; driver: DriverAccount }>('/auth/driver/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
  return driver;
}

export async function adminLogin(email: string, password: string) {
  const { token, admin } = await request<{ token: string; admin: AdminAccount }>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
  return admin;
}

export function logout() {
  setToken(null);
}

export const requestPasswordReset = (email:string) => request<{message:string;developmentResetToken?:string}>('/auth/password/request',{method:'POST',body:JSON.stringify({email})});
export const resetPassword = (token:string,password:string) => request<{success:boolean}>('/auth/password/reset',{method:'POST',body:JSON.stringify({token,password})});

export const getMe = () => request<{ role: 'admin' | 'driver'; admin?: AdminAccount; driver?: DriverAccount; availableRoles?: string[] }>('/auth/me');
export const switchRole = (role:'admin'|'driver') => request<{token:string;role:string;admin?:AdminAccount;driver?:DriverAccount;availableRoles?:string[]}>('/auth/switch-role',{method:'POST',body:JSON.stringify({role})});

// ---------- Admins & drivers ----------

export const getAdmins = () => request<AdminAccount[]>('/admins');
export const addAdmin = (admin: Partial<AdminAccount>) => request<AdminAccount>('/auth/admin', { method: 'POST', body: JSON.stringify(admin) });
export const resetDemoData = () => request<{ success: boolean }>('/admins/reset-demo', { method: 'POST' });

export const getDrivers = () => request<DriverAccount[]>('/drivers');
export const addDriver = (driver: Partial<DriverAccount>) => request<DriverAccount>('/drivers', { method: 'POST', body: JSON.stringify(driver) });
export const approveDriver = (id: string) => request<DriverAccount>(`/drivers/${id}/approve`, { method: 'PUT' });
export const suspendDriver = (id: string) => request<DriverAccount>(`/drivers/${id}/suspend`, { method: 'PUT' });
export const setMyDriverStatus = (online: boolean) => request<DriverAccount>('/drivers/me/status', { method: 'PUT', body: JSON.stringify({ online }) });
export const setMyLocation = (lat: number, lng: number) => request<DriverAccount>('/drivers/me/location', { method: 'PUT', body: JSON.stringify({ lat, lng }) });

// ---------- Deliveries ----------

export const getDeliveries = () => request<Delivery[]>('/deliveries');
export const createDelivery = (delivery: Partial<Delivery>) => request<Delivery>('/deliveries', { method: 'POST', body: JSON.stringify(delivery) });
export const assignDelivery = (id: string, driverId: string | null) =>
  request<Delivery>(`/deliveries/${id}/assign`, { method: 'PUT', body: JSON.stringify({ driverId }) });
export const acceptDelivery = (id: string) => request<Delivery>(`/deliveries/${id}/accept`, { method: 'PUT' });
export const rejectDelivery = (id: string, reason: string) =>
  request<Delivery>(`/deliveries/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) });
export const updateDeliveryStatus = (id: string, status: Delivery['status']) =>
  request<Delivery>(`/deliveries/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });

// ---------- Earnings & notifications ----------

export const getEarnings = () => request<EarningsRecord[]>('/earnings');
export const getNotifications = () => request<NotificationItem[]>('/notifications');
export const markNotificationRead = (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PUT' });

export const getFinanceSummary = () => request<{grossFees:number;driverEarnings:number;platformRevenue:number;pendingPayouts:number}>('/finance/summary');
export const getPayouts = () => request<any[]>('/finance/payouts');
export const updatePayoutStatus = (id:string,status:string) => request<any>(`/finance/payouts/${id}/status`,{method:'PUT',body:JSON.stringify({status})});

export const requestPayout = (amount:number) => request<any>('/finance/payouts/request',{method:'POST',body:JSON.stringify({amount})});
