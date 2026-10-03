import React,{useEffect,useRef,useState} from 'react';
import { DriverAccount, Delivery } from '../types';

declare global { interface Window { google:any; __deliveriMapsPromise?:Promise<any>; } }

async function loadGoogleMaps(){
  const key=import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string|undefined;
  if(!key) return null;
  if(window.google?.maps) return window.google.maps;
  if(!window.__deliveriMapsPromise){
    window.__deliveriMapsPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script'); s.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry`; s.async=true; s.defer=true; s.onload=()=>resolve(window.google.maps); s.onerror=reject; document.head.appendChild(s);
    });
  }
  return window.__deliveriMapsPromise;
}

export default function LiveMap({drivers,deliveries,focusDriver,compact=false}:{drivers:DriverAccount[];deliveries:Delivery[];focusDriver?:DriverAccount|null;compact?:boolean}){
  const ref=useRef<HTMLDivElement>(null); const [ready,setReady]=useState(false); const [hasKey,setHasKey]=useState(true);
  useEffect(()=>{let mounted=true; loadGoogleMaps().then(m=>{if(mounted){setHasKey(!!m);setReady(!!m)}}).catch(()=>mounted&&setHasKey(false)); return()=>{mounted=false}},[]);
  useEffect(()=>{
    if(!ready||!ref.current||!window.google?.maps)return;
    const maps=window.google.maps; const points=[...drivers.map(d=>({lat:d.currentLat,lng:d.currentLng})),...deliveries.filter(d=>d.dropoffLat&&d.dropoffLng).map(d=>({lat:d.dropoffLat,lng:d.dropoffLng}))];
    if(focusDriver) points.push({lat:focusDriver.currentLat,lng:focusDriver.currentLng});
    const center=points[0]||{lat:6.5244,lng:3.3792}; const map=new maps.Map(ref.current,{center,zoom:12,streetViewControl:false,mapTypeControl:false,fullscreenControl:true});
    const bounds=new maps.LatLngBounds();
    drivers.filter(d=>Number.isFinite(d.currentLat)&&Number.isFinite(d.currentLng)).forEach(d=>{const p={lat:d.currentLat,lng:d.currentLng}; bounds.extend(p); new maps.Marker({position:p,map,title:`${d.name} • ${d.status}`,label:d.status==='Online'?'D':undefined});});
    deliveries.filter(d=>Number.isFinite(d.dropoffLat)&&Number.isFinite(d.dropoffLng)).forEach(d=>{const p={lat:d.dropoffLat,lng:d.dropoffLng};bounds.extend(p);new maps.Marker({position:p,map,title:`${d.trackingNumber} • ${d.status}`});});
    if(points.length>1) map.fitBounds(bounds,{top:30,bottom:30,left:30,right:30});
  },[ready,drivers,deliveries,focusDriver]);
  if(!hasKey) return <div className={`w-full ${compact?'h-36':'h-96'} rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-5 text-center`}><div><div className="text-sm font-bold text-white">Live Google Map</div><p className="text-[10px] text-slate-400 mt-1">Set VITE_GOOGLE_MAPS_API_KEY to enable live maps. Driver GPS coordinates are already being collected securely.</p></div></div>;
  return <div ref={ref} className={`w-full ${compact?'h-36':'h-96'} rounded-2xl overflow-hidden border border-slate-800`}/>;
}
