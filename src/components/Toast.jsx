import React from 'react';

export default function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
          <button onClick={() => removeToast(toast.id)} className="toast-close">×</button>
        </div>
      ))}
    </div>
  );
}
