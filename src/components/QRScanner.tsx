/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, AlertTriangle, CheckCircle, Smartphone, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';

interface QRScannerProps {
  correctToken: string;
  trackingNumber: string;
  onScanSuccess: (scannedToken: string) => void;
  onScanCancel: () => void;
}

export default function QRScanner({ correctToken, trackingNumber, onScanSuccess, onScanCancel }: QRScannerProps) {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<'success' | 'fail' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Play synthesized audio notification for instant tactile feedback
  const playSound = (type: 'beep' | 'error') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 (high pitch beep)
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        
        // Secondary tone for chime feel
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1109, ctx.currentTime); // C#6
          gain2.gain.setValueAtTime(0.2, ctx.currentTime);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.2);
        }, 80);
      } else {
        // Buzz error sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, ctx.currentTime); // Low buzz
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.log('Audio feedback not supported or blocked by user policy', e);
    }
  };

  // Turn on/off webcam
  useEffect(() => {
    async function startCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setHasCameraPermission(true);
        } else {
          setHasCameraPermission(false);
          setCameraError('Webcam media constraints are not supported on this device/sandboxed environment.');
        }
      } catch (err: any) {
        console.error('Camera capture error:', err);
        setHasCameraPermission(false);
        setCameraError(err.message || 'Permission denied or webcam already in use');
      }
    }

    startCamera();

    return () => {
      // Clean up webcam stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleValidate = (tokenValue: string) => {
    const CleanValue = tokenValue.trim();
    if (!CleanValue) return;

    setIsScanning(false);
    if (CleanValue === correctToken) {
      playSound('beep');
      setScannedResult('success');
      setTimeout(() => {
        onScanSuccess(CleanValue);
      }, 1500);
    } else {
      playSound('error');
      setScannedResult('fail');
      setErrorMessage(`Invalid QR code for delivery ${trackingNumber}. Clean code found: "${CleanValue}".`);
    }
  };

  const handleRetry = () => {
    setScannedResult(null);
    setErrorMessage(null);
    setManualToken('');
    setIsScanning(true);
  };

  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col text-white z-50 overflow-hidden font-sans">
      {/* Header */}
      <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-sm tracking-tight">QR Confirmation Scan</span>
        </div>
        <button 
          onClick={onScanCancel} 
          className="p-1 rounded-full hover:bg-slate-800 transition text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between p-4 relative">
        {/* Overlay notifications / scan result screens */}
        {scannedResult === 'success' && (
          <div className="absolute inset-0 bg-emerald-950/95 z-20 flex flex-col items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' }}
            >
              <CheckCircle className="w-20 h-20 text-emerald-400 mb-4 animate-pulse" />
            </motion.div>
            <h3 className="text-xl font-bold mb-2 text-emerald-100">TradeEase QR Confirmed!</h3>
            <p className="text-emerald-300 text-xs max-w-xs">
              Delivery matched successfully. Automatically confirming and registering delivery timestamp.
            </p>
          </div>
        )}

        {scannedResult === 'fail' && (
          <div className="absolute inset-0 bg-rose-950/95 z-20 flex flex-col items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              type="spring"
            >
              <AlertTriangle className="w-20 h-20 text-rose-500 mb-4" />
            </motion.div>
            <h3 className="text-lg font-bold mb-2 text-rose-100">Verification Failure</h3>
            <p className="text-rose-300 text-xs max-w-xs mb-6">
              {errorMessage}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button 
                onClick={handleRetry} 
                className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Scan Code Again
              </button>
              <button 
                onClick={onScanCancel} 
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
              >
                Cancel scan
              </button>
            </div>
          </div>
        )}

        {/* Video stream viewport or fallback */}
        <div className="w-full aspect-[4/3] max-h-[220px] rounded-2xl bg-black border-2 border-slate-700 relative overflow-hidden flex items-center justify-center">
          {hasCameraPermission === true && isScanning ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover transform rotate-0"
            />
          ) : (
            <div className="absolute inset-0 bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center p-3">
              <Smartphone className="w-12 h-12 text-slate-500 mb-2 animate-bounce" />
              <span className="text-slate-400 font-semibold text-xs mb-1">Camera Feed Restricted</span>
              <p className="text-[10px] text-slate-500 max-w-xs">
                To respect browser sandbox policies, or if no webcam exists, please use the simulator triggers below!
              </p>
            </div>
          )}

          {/* Real-time radar/scanner crosshairs overlay */}
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-40 border-2 border-emerald-400 rounded-lg relative">
                {/* Pulsing Target corners */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400"></div>
                
                {/* Lasers moving line */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-0 left-0 animate-[shimmer_2s_infinite] shadow-[0_0_10px_#10b981]"></div>
              </div>
            </div>
          )}
        </div>

        {/* Nigeria Logistics / Guide */}
        <div className="w-full bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-center text-[10px] text-slate-400 leading-relaxed self-center">
          <span className="font-bold text-slate-200">Nigeria TradeEase Security Standard</span>: Hand over package ONLY after scanning! Scan the printed QR on the merchant packing slip or client screen.
        </div>

        {/* QUICK SIMULATION TRIGGERS (Crucial for robust, verifiable flow) */}
        <div className="w-full flex flex-col gap-3.5 bg-slate-900 rounded-2xl p-3.5 border border-slate-800 mb-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Simulate Scan Input:</span>
            <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
              <Volume2 className="w-3 h-3" /> Audio Enabled
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleValidate(correctToken)}
              className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-center text-xs font-bold transition flex flex-col items-center"
            >
              <span className="font-mono text-[9px] text-emerald-200">MATCH (Correct)</span>
              <span className="truncate max-w-full text-[10px] mt-0.5">{correctToken}</span>
            </button>
            <button
              onClick={() => handleValidate('QR-TE-BAD-CODE-999')}
              className="py-2.5 px-2 bg-rose-900/80 hover:bg-rose-950 text-rose-300 rounded-xl text-center text-xs font-bold transition flex flex-col items-center border border-rose-800"
            >
              <span className="font-mono text-[9px] text-rose-400">MISMATCH (Fraud)</span>
              <span className="truncate max-w-full text-[10px] mt-0.5">QR-TE-BAD-CODE</span>
            </button>
          </div>

          <div className="relative pt-2.5 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 absolute bg-slate-900 px-1 -top-2.5 left-2 font-medium">Or Enter Token Manually</span>
            <div className="flex gap-1.5 mt-1.5">
              <input
                type="text"
                placeholder="Enter Token e.g. QR-TE-LAG-10928"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl text-xs px-2.5 py-2 text-slate-100 placeholder-slate-600 font-mono"
              />
              <button
                onClick={() => handleValidate(manualToken)}
                className="px-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-medium transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
