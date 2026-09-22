import { Component } from 'react';

// Last line of defence: a render crash shows a message instead of a blank screen.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="auth">
        <div className="card stack">
          <h1>Something went wrong</h1>
          <div className="alert error">{this.state.error.message}</div>
          <button className="btn gold" onClick={() => window.location.assign('/')}>Reload</button>
        </div>
      </div>
    );
  }
}
