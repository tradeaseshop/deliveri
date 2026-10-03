/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Battery, Wifi, Signal, RefreshCw } from 'lucide-react';

interface PhoneFrameProps {
  children: React.ReactNode;
  onRestartDemo?: () => void;
}

export default function PhoneFrame({ children, onRestartDemo }: PhoneFrameProps) {
  const [time, setTime] = useState('12:18');

  // Sync simulated phone time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mx-auto max-w-[390px] w-full h-[812px] bg-slate-950 rounded-[50px] p-3.5 shadow-2xl border-4 border-slate-800 ring-12 ring-slate-900 ring-opacity-80 flex flex-col overflow-hidden select-none">
      {/* Top Camera Notch */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6.5 bg-slate-950 rounded-b-2xl z-30 flex items-center justify-between px-3 text-slate-400">
        <div className="h-1.5 w-1.5 rounded-full bg-slate-800"></div>
        <div className="h-1 w-12 rounded-full bg-slate-800"></div>
        <div className="h-1.5 w-1.5 rounded-full bg-blue-900 border border-blue-400"></div>
      </div>

      {/* Buttons on the left (volume, silencer) */}
      <div className="absolute left-[-4px] top-24 w-[4px] h-8 bg-slate-700 rounded-l"></div>
      <div className="absolute left-[-4px] top-36 w-[4px] h-12 bg-slate-700 rounded-l"></div>
      <div className="absolute left-[-4px] top-52 w-[4px] h-12 bg-slate-700 rounded-l"></div>

      {/* Button on the right (power) */}
      <div className="absolute right-[-4px] top-32 w-[4px] h-16 bg-slate-700 rounded-r"></div>

      {/* Internal Phone Bezel and Screen Area */}
      <div className="relative w-full h-full bg-white rounded-[38px] overflow-hidden flex flex-col z-10 border border-slate-900">
        
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 bg-slate-900 text-white flex justify-between items-center text-xs font-semibold select-none z-20">
          <div>{time}</div>
          <div className="flex items-center space-x-1.5">
            <Signal className="w-3.5 h-3.5" />
            <span className="text-[10px] tracking-tight">DELIVERI 5G</span>
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* Demo Controller Utility Header (Subtle indicator inside screen top) */}
        <div className="bg-slate-800 text-[10px] text-slate-300 px-4 py-1 flex justify-between items-center border-b border-slate-700 z-10">
          <span className="font-mono tracking-wider text-emerald-400 font-bold">● SIMULATED APP v1.02</span>
          {onRestartDemo && (
            <button 
              onClick={onRestartDemo} 
              className="flex items-center gap-1 text-slate-300 hover:text-white transition font-semibold"
              title="Reset Simulated Database & State"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Reset Demo State
            </button>
          )}
        </div>

        {/* Children Render Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 text-slate-900 relative">
          {children}
        </div>

        {/* Home Safe Area / Bezel Indicator at Bottom */}
        <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-slate-400 rounded-full z-30 opacity-60"></div>
      </div>
    </div>
  );
}
