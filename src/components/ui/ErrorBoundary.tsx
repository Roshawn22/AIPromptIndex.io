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
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
          <p className="mb-3 text-sm font-[var(--font-display)] text-[var(--color-text-secondary)]">
            Something went wrong loading this component.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-[13px] font-[var(--font-display)] font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-muted)]"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
