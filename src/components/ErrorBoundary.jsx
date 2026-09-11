import React from 'react';
import { AlertTriangle } from 'lucide-react';
import '../index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', width: '100vw', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)',
          textAlign: 'center', padding: '2rem'
        }}>
          <AlertTriangle size={64} color="var(--error-color, #ff4444)" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong.</h1>
          <p style={{ opacity: 0.8, marginBottom: '2rem', maxWidth: '500px' }}>
            We encountered an unexpected error. This has been logged. 
            Please refresh the page to continue.
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1.1rem', borderRadius: '8px', cursor: 'pointer',
                     backgroundColor: 'var(--accent-color)', color: 'white', border: 'none' }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
