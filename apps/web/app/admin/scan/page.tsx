'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ScanLine, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

type ScanResult = {
  success:      boolean;
  action:       'DROPOFF_SCANNED' | 'COLLECTION_SCANNED';
  newStatus:    string;
  waybill:      string;
  sellerPayout?: string;
} | null;

export default function AdminScanPage() {
  const router  = useRouter();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const [scanning,    setScanning]    = useState(false);
  const [result,      setResult]      = useState<ScanResult>(null);
  const [error,       setError]       = useState('');
  const [cameraError, setCameraError] = useState('');
  const [manualToken, setManualToken] = useState('');

  // Start camera
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        startDetection(stream);
      })
      .catch(() => setCameraError('Camera not available. Use the manual entry below.'));

    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  async function startDetection(stream: MediaStream) {
    // Use BarcodeDetector API (Chrome/Edge) if available
    if (!('BarcodeDetector' in window)) return;
    // @ts-ignore
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const canvas   = document.createElement('canvas');
    const ctx      = canvas.getContext('2d')!;

    const scan = async () => {
      if (!videoRef.current || scanning) return;
      canvas.width  = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      try {
        const codes = await detector.detect(canvas);
        if (codes.length > 0) {
          const token = codes[0].rawValue as string;
          if (token.startsWith('NK:')) await processToken(token);
        }
      } catch { /* ignore detection errors */ }
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  }

  async function processToken(token: string) {
    if (scanning) return;
    setScanning(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const res = await fetch('/api/qr/scan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ token }),
    });
    const json = await res.json();

    if (!res.ok) {
      const messages: Record<string, string> = {
        invalid_qr:       'Invalid or tampered QR code.',
        qr_expired:       'This QR code has expired.',
        qr_already_used:  'This QR has already been scanned.',
        wrong_order_state:'Order is not in the expected state.',
        forbidden:        'Your account is not authorised to scan QR codes.',
      };
      setError(messages[json.error] ?? json.error ?? 'Scan failed.');
      setScanning(false);
      return;
    }

    streamRef.current?.getTracks().forEach(t => t.stop());
    setResult(json);
  }

  const reset = () => {
    setResult(null);
    setScanning(false);
    setError('');
    setManualToken('');
    // Restart camera
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        startDetection(stream);
      });
  };

  // ── Result screen ────────────────────────────────────────────────────────
  if (result) {
    const isCollection = result.action === 'COLLECTION_SCANNED';
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto ${isCollection ? 'bg-green-500/20 border-2 border-green-500/40' : 'bg-blue-500/20 border-2 border-blue-500/40'}`}>
            <CheckCircle2 size={48} strokeWidth={1.5} className={isCollection ? 'text-green-400' : 'text-blue-400'} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {result.action === 'DROPOFF_SCANNED' ? 'Drop-off confirmed!' : 'Collection confirmed!'}
            </h1>
            <p className="text-white/60 text-sm mt-2">
              {result.action === 'DROPOFF_SCANNED'
                ? 'Item received at hub. Buyer has been sent their collection QR.'
                : `Buyer collected. ${result.sellerPayout ? `Seller payout: ${result.sellerPayout}.` : ''}`}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl px-5 py-4">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Waybill</p>
            <p className="text-white font-mono font-bold text-xl tracking-wider">{result.waybill}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full font-bold transition">
              <ScanLine size={16} /> Scan another
            </button>
            <button onClick={() => router.push('/klerebank')}
              className="flex-1 py-3.5 border border-white/20 text-white/70 hover:text-white rounded-full font-medium transition">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Scanner screen ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#111] flex flex-col">
      {/* Header */}
      <div className="bg-[#BE1E2D] px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/klerebank')} className="text-white/80 hover:text-white transition">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white text-xs font-bold uppercase tracking-widest">Scanning</span>
        </div>
      </div>

      {/* Camera */}
      <div className="flex-1 relative flex flex-col items-center justify-center gap-6 p-6">

        {!cameraError ? (
          <>
            <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {/* Finder overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 relative">
                  {[
                    'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                    'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                    'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-8 h-8 border-white ${cls}`} />
                  ))}
                </div>
              </div>
              {scanning && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <span className="bg-black/70 text-white text-xs px-4 py-2 rounded-full">Processing...</span>
                </div>
              )}
            </div>
            <p className="text-white/50 text-sm text-center">
              Point the camera at a NextKid QR code
            </p>
            {!('BarcodeDetector' in window) && (
              <p className="text-amber-400 text-xs text-center max-w-xs">
                Auto-detection not supported in this browser. Use the manual entry below or try Chrome/Edge.
              </p>
            )}
          </>
        ) : (
          <div className="text-center space-y-2">
            <XCircle size={40} strokeWidth={1.5} className="text-white/20 mx-auto" />
            <p className="text-white/50 text-sm">{cameraError}</p>
          </div>
        )}

        {/* Manual token entry — fallback */}
        <div className="w-full max-w-sm space-y-3">
          <p className="text-white/30 text-xs text-center uppercase tracking-wide">Or paste QR token manually</p>
          <input
            value={manualToken}
            onChange={e => setManualToken(e.target.value)}
            placeholder="NK:DROPOFF:..."
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-white/40 transition font-mono"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={() => manualToken.trim() && processToken(manualToken.trim())}
            disabled={!manualToken.trim() || scanning}
            className="w-full py-3 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-white/10 disabled:text-white/30 text-white rounded-full font-semibold transition"
          >
            {scanning ? 'Processing...' : 'Process QR token'}
          </button>
        </div>

      </div>
    </div>
  );
}
