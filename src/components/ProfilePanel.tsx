import React, { useEffect, useState } from 'react';
import { X, Camera, Lock, Save } from 'lucide-react';
import { AdminAccount, DriverAccount } from '../types';
import * as api from '../api';

type Props={account:AdminAccount|DriverAccount; onClose:()=>void; onSaved:(account:AdminAccount|DriverAccount)=>void;};
function fileToData(file:File,max:number):Promise<string>{return new Promise((resolve,reject)=>{if(file.size>max)return reject(new Error(`File is too large. Maximum ${Math.round(max/1024/1024)} MB.`));const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Unable to read the file.'));r.readAsDataURL(file);});}

export default function ProfilePanel({account,onClose,onSaved}:Props){
 const driver='vehicleType' in account;
 const [form,setForm]=useState<any>({...account}); const [currentPassword,setCurrentPassword]=useState(''); const [newPassword,setNewPassword]=useState(''); const [avatar,setAvatar]=useState(account.avatar||''); const [idDocument,setIdDocument]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [saved,setSaved]=useState(false);
 useEffect(()=>{setForm({...account});setAvatar(account.avatar||'');},[account]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');setSaved(false);try{const result=await api.updateMyProfile({...form,avatar:avatar||null,idDocument:idDocument||undefined,currentPassword:currentPassword||undefined,newPassword:newPassword||undefined});const updated=(result.admin||result.driver)!;onSaved(updated);setSaved(true);setCurrentPassword('');setNewPassword('');setIdDocument('');}catch(e:any){setError(e.message||'Unable to update profile.')}finally{setBusy(false)}};
 return <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
  <form onSubmit={save} className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-brand-surface border border-brand-border rounded-3xl shadow-2xl p-5 space-y-4 text-brand-text">
   <div className="flex items-center justify-between border-b border-brand-border pb-3"><div><h2 className="text-lg font-black">My Profile</h2><p className="text-xs text-brand-muted">Update your account details and security settings.</p></div><button type="button" onClick={onClose}><X className="w-5 h-5"/></button></div>
   {error&&<div className="p-3 rounded-xl bg-rose-950/60 text-rose-300 text-xs">{error}</div>}{saved&&<div className="p-3 rounded-xl bg-emerald-950/60 text-emerald-300 text-xs">Profile updated successfully.</div>}
   <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full overflow-hidden bg-brand-bg border border-brand-border flex items-center justify-center">{avatar?<img src={avatar} className="w-full h-full object-cover"/>:<Camera className="w-5 h-5 text-brand-muted"/>}</div><label className="text-xs font-bold cursor-pointer"><span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-border">Change photo</span><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async e=>{try{if(e.target.files?.[0])setAvatar(await fileToData(e.target.files[0],2*1024*1024))}catch(err:any){setError(err.message)}}}/></label></div>
   <div className="grid md:grid-cols-2 gap-3">
    <Field label="Legal name"><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Email"><input value={form.email||''} disabled/></Field>
    <Field label="Phone"><input value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></Field>
    <Field label={driver?'Emergency contact':'Office location'}><input value={driver?(form.emergencyContact||''):(form.officeLocation||'')} onChange={e=>setForm({...form,[driver?'emergencyContact':'officeLocation']:e.target.value})}/></Field>
    <Field label="Address"><input value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
    {driver&&<>
      <Field label="ID type"><input value={form.idType||''} onChange={e=>setForm({...form,idType:e.target.value})}/></Field><Field label="ID number"><input value={form.idNumber||''} onChange={e=>setForm({...form,idNumber:e.target.value})}/></Field>
      <Field label="Vehicle type"><select value={form.vehicleType||'Motorcycle'} onChange={e=>setForm({...form,vehicleType:e.target.value})}><option>Motorcycle</option><option>Delivery Van</option><option>Truck</option><option>E-Bike</option></select></Field>
      <Field label="Vehicle plate"><input value={form.vehiclePlate||''} onChange={e=>setForm({...form,vehiclePlate:e.target.value})}/></Field>
      <Field label="Vehicle model"><input value={form.vehicleModel||''} onChange={e=>setForm({...form,vehicleModel:e.target.value})}/></Field><Field label="Vehicle colour"><input value={form.vehicleColor||''} onChange={e=>setForm({...form,vehicleColor:e.target.value})}/></Field><Field label="Vehicle year"><input type="number" value={form.vehicleYear||''} onChange={e=>setForm({...form,vehicleYear:e.target.value?Number(e.target.value):null})}/></Field>
      <Field label="Replace ID document"><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={async e=>{try{if(e.target.files?.[0])setIdDocument(await fileToData(e.target.files[0],5*1024*1024))}catch(err:any){setError(err.message)}}}/></Field>
    </>}
   </div>
   <div className="border-t border-brand-border pt-4 space-y-3"><div className="flex items-center gap-2 font-bold text-sm"><Lock className="w-4 h-4"/> Change password</div><div className="grid md:grid-cols-2 gap-3"><Field label="Current password"><input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></Field><Field label="New password"><input type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></Field></div></div>
   <div className="flex gap-2 justify-end"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-brand-border text-xs font-bold">Cancel</button><button disabled={busy} className="px-4 py-2 rounded-xl bg-brand-primary text-brand-surface text-xs font-black inline-flex items-center gap-2"><Save className="w-4 h-4"/>{busy?'Saving...':'Save changes'}</button></div>
  </form></div>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="space-y-1 text-xs font-bold"><span className="block text-brand-muted uppercase text-[10px]">{label}</span>{React.cloneElement(children as React.ReactElement<any>,{className:'w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary'})}</label>}
