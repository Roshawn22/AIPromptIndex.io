import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AIPromptIndex] Component error:', error, errorInfo);

    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        extra: { componentStack: errorInfo.componentStack },
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-1)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              marginBottom: '0.75rem',
            }}
          >
            Something went wrong loading this component.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
