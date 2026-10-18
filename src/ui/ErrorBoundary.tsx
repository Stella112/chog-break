import { Component, type ReactNode } from 'react';

/** §A2.12: never silently swallow a failure — show a recoverable error state, never a stack trace. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[CHOG//BREAK] recovered from a UI error:', error instanceof Error ? error.message : error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="panel error-panel" role="alert">
        <div>
          <p className="mono">⚠ THE EXPERIMENT MALFUNCTIONED</p>
          <p className="small dim">Something broke in this screen. Your notebook is safe.</p>
        </div>
        <button
          className="btn"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onReset?.();
          }}
        >
          BACK TO THE LAB
        </button>
      </div>
    );
  }
}
