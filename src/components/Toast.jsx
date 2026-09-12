import React from 'react';

export default function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`} role="alert">
          <span>{toast.message}</span>
          <button 
            onClick={() => removeToast(toast.id)} 
            className="toast-close" 
            aria-label="Close notification"
            tabIndex="0"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
