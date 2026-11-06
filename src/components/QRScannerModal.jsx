import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Upload, AlertCircle, Sparkles, Image as ImageIcon } from 'lucide-react';
import jsQR from 'jsqr';

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'upload'
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));

  // Parse invite URL or hash into { room, secret }
  const parseInviteCode = (text) => {
    try {
      let hash = '';
      if (text.includes('#')) {
        hash = text.split('#')[1];
      } else if (text.includes('?')) {
        hash = text.split('?')[1];
      } else {
        hash = text;
      }
      const params = new URLSearchParams(hash);
      const room = params.get('room');
      const secret = params.get('secret');
      if (room && secret) {
        return { room, secret };
      }
    } catch (e) {
      console.warn('Invite parse error:', e);
    }
    return null;
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setImagePreview(null);
      setError('');
      return;
    }

    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported by your browser. Please switch to "Upload Image".');
        setActiveTab('upload');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 640 }
        }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.warn('Video play error:', e));

        // Start jsQR scanning loop at 10 fps
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        scanIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || !video.videoWidth) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (qrCode && qrCode.data) {
            const parsed = parseInviteCode(qrCode.data);
            if (parsed) {
              stopCamera();
              onScanSuccess(parsed);
            } else {
              setError('QR code detected, but it does not contain a valid NijiSamvad invite link.');
            }
          }
        }, 120);
      }
    } catch (err) {
      console.warn('Camera scan access error:', err);
      setError('Could not access camera. Please allow camera permissions or upload an invite image.');
      setActiveTab('upload');
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setError('');
    setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setImagePreview(dataUrl);

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        setIsProcessingImage(false);

        if (qrCode && qrCode.data) {
          const parsed = parseInviteCode(qrCode.data);
          if (parsed) {
            stopCamera();
            onScanSuccess(parsed);
          } else {
            setError('Scanned QR code does not contain a valid NijiSamvad invite.');
          }
        } else {
          setError('No QR code detected in this image. Please ensure the QR code is clearly visible.');
        }
      };
      img.onerror = () => {
        setIsProcessingImage(false);
        setError('Failed to load image file.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '440px', padding: '1.75rem', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0 }}>
            <Camera size={20} style={{ color: 'var(--primary)' }} />
            Scan Invite QR Code
          </h3>
          <button onClick={onClose} className="icon-btn" title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            style={{
              flex: 1,
              padding: '0.45rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'camera' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'camera' ? '#000' : 'var(--text-secondary)',
              fontWeight: activeTab === 'camera' ? '600' : '500',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Camera size={15} /> Live Camera
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            style={{
              flex: 1,
              padding: '0.45rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'upload' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'upload' ? '#000' : 'var(--text-secondary)',
              fontWeight: activeTab === 'upload' ? '600' : '500',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Upload size={15} /> Upload Image
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.8rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Camera View */}
        {activeTab === 'camera' && (
          <div>
            <div style={{ position: 'relative', width: '100%', height: '240px', background: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Viewfinder Target */}
              <div style={{
                position: 'absolute',
                width: '160px',
                height: '160px',
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
                  animation: 'pulse 1.8s infinite ease-in-out'
                }}></div>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
              Center the room invite QR code inside the box to connect.
            </p>
          </div>
        )}

        {/* Upload Image View */}
        {activeTab === 'upload' && (
          <div>
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              border: '2px dashed var(--border-strong)',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              cursor: 'pointer',
              padding: '1rem',
              textAlign: 'center',
              transition: 'border-color 0.2s'
            }}>
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              
              {imagePreview ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={imagePreview} alt="QR Preview" style={{ maxHeight: '120px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isProcessingImage ? 'Scanning QR...' : 'Click to choose another image'}
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255, 214, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', color: 'var(--primary)' }}>
                    <ImageIcon size={22} />
                  </div>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Click or drag image here
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Supports PNG, JPG, WebP, SVG screenshots
                  </span>
                </>
              )}
            </label>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
