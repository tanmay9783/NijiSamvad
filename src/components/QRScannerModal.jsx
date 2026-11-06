import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Upload, AlertCircle } from 'lucide-react';

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Parse invite URL or hash into { room, secret }
  const parseInviteCode = (text) => {
    try {
      let hash = '';
      if (text.includes('#')) {
        hash = text.split('#')[1];
      } else {
        hash = text;
      }
      const params = new URLSearchParams(hash);
      const room = params.get('room');
      const secret = params.get('secret');
      if (room && secret) {
        return { room, secret };
      }
    } catch (e) {}
    return null;
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setError('');
    setIsScanning(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported by your browser.');
        setIsScanning(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Check native BarcodeDetector support
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const scanLoop = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
              animFrameRef.current = requestAnimationFrame(scanLoop);
              return;
            }
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                const parsed = parseInviteCode(rawValue);
                if (parsed) {
                  stopCamera();
                  onScanSuccess(parsed);
                  return;
                } else {
                  setError('Detected QR code does not contain a valid room invite.');
                }
              }
            } catch (err) {}
            animFrameRef.current = requestAnimationFrame(scanLoop);
          };
          animFrameRef.current = requestAnimationFrame(scanLoop);
        } else {
          setError('Live camera scanning requires BarcodeDetector API. You can upload an invite QR code image instead.');
        }
      }
    } catch (err) {
      console.warn('Camera scan access error:', err);
      setError('Could not access camera. Please allow camera permissions or upload an invite image.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if ('BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
          try {
            const barcodes = await detector.detect(img);
            URL.revokeObjectURL(img.src);
            if (barcodes.length > 0) {
              const parsed = parseInviteCode(barcodes[0].rawValue);
              if (parsed) {
                stopCamera();
                onScanSuccess(parsed);
              } else {
                setError('Uploaded QR code is not a valid NijiSamvad invite.');
              }
            } else {
              setError('No QR code detected in the uploaded image.');
            }
          } catch {
            setError('Failed to scan uploaded image.');
          }
        };
      } catch {
        setError('QR detector error on image.');
      }
    } else {
      setError('Direct image QR decoding is not supported in this browser. Please copy and paste the invite link directly.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '420px', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
            <Camera size={20} style={{ color: 'var(--primary)' }} />
            Scan Invite QR Code
          </h3>
          <button onClick={onClose} className="icon-btn" title="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ position: 'relative', width: '100%', height: '260px', background: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Scanner Overlay Box */}
          <div style={{
            position: 'absolute',
            width: '180px',
            height: '180px',
            border: '2px solid var(--primary)',
            borderRadius: '16px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '100%',
              height: '2px',
              background: 'var(--primary)',
              boxShadow: '0 0 8px var(--primary)',
              animation: 'pulse 2s infinite'
            }}></div>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>
          Point your camera at a room invite QR code.
        </p>

        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
          <label className="btn" style={{ flex: 1, padding: '0.65rem 1rem', fontSize: '0.85rem', background: 'var(--surface-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <Upload size={16} />
            Upload Image
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <button onClick={onClose} className="btn" style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--border)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

