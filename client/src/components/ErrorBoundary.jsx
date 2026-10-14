import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RescueLink ErrorBoundary] Uncaught runtime exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />
            
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center text-3xl mx-auto mb-4">
              ⚠️
            </div>

            <h1 className="text-xl font-extrabold text-white mb-2 tracking-tight">
              Application Encountered an Error
            </h1>

            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              We recovered from an unexpected rendering exception. Your session and recorded emergencies are safe.
            </p>

            {this.state.error && (
              <div className="bg-slate-950/80 rounded-xl p-3 mb-6 text-left border border-slate-800 text-[11px] font-mono text-rose-300 break-words max-h-28 overflow-y-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="btn-emergency flex-1 py-3 text-xs justify-center cursor-pointer"
              >
                ↻ Reload View
              </button>
              <button
                onClick={this.handleReset}
                className="btn-secondary flex-1 py-3 text-xs justify-center cursor-pointer bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              >
                🏠 Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
