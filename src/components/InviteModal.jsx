import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, Shield, Download } from 'lucide-react';
import { generateQRCodeSVG } from '../services/qr';

export default function InviteModal({ isOpen, onClose, roomName, roomSecret }) {
  const [copied, setCopied] = useState(false);
  const [qrSvgString, setQrSvgString] = useState('');

  const inviteUrl = typeof window !== 'undefined' && roomName && roomSecret
    ? `${window.location.origin}/#room=${encodeURIComponent(roomName)}&secret=${encodeURIComponent(roomSecret)}`
    : '';

  useEffect(() => {
    if (inviteUrl) {
      generateQRCodeSVG(inviteUrl, 200).then(svg => setQrSvgString(svg));
    }
  }, [inviteUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nijisamvad-qr-${roomName}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" style={{ zIndex: 1050 }}>
      <div className="modal-content" style={{ maxWidth: '440px', padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
            <QrCode size={20} style={{ color: 'var(--primary)' }} />
            Invite to #{roomName}
          </h3>
          <button onClick={onClose} className="icon-btn" title="Close">
            <X size={18} />
          </button>
        </div>

        {/* QR Code Container */}
        <div style={{
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#ffffff',
          padding: '12px',
          borderRadius: '16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          marginBottom: '1.25rem'
        }}>
          <div dangerouslySetInnerHTML={{ __html: qrSvgString }} />
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Anyone with this link or QR code can join this encrypted room without manual key entry.
        </p>

        {/* Copy Invite Link Field */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--surface)',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          marginBottom: '1rem'
        }}>
          <input
            type="text"
            readOnly
            value={inviteUrl}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              textOverflow: 'ellipsis'
            }}
          />
          <button onClick={handleCopy} className="btn-small btn" style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Security Notice */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(255, 214, 0, 0.08)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem',
          textAlign: 'left',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.25rem'
        }}>
          <Shield size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>
            <strong>Zero-Knowledge Fragment</strong>: The room secret is placed in the URL hash (<code>#</code>), which browsers mathematically never transmit to the server.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleDownloadQR} className="btn" style={{ flex: 1, padding: '0.65rem 1rem', fontSize: '0.85rem', background: 'var(--surface-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Download size={15} />
            Save QR Image
          </button>
          <button onClick={onClose} className="btn" style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

