/**
 * src/components/ErrorBoundary.tsx  (Brick 10d)
 *
 * Top-level React error boundary. Catches render crashes so the app never
 * white-screens. Shows a recovery card with a reload button.
 *
 * React error boundaries must be class components — hooks cannot catch errors.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional override for the fallback title */
  title?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Log to console — a future follow-on brick can wire this to Sentry/LogRocket
    console.error("[ErrorBoundary] Render crash caught:", error, info.componentStack);
  }

  handleReload = () => {
    // Reset state first so the boundary clears, then reload the page
    this.setState({ hasError: false, message: "" }, () => {
      window.location.reload();
    });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary-container" role="alert" aria-live="assertive">
        <div className="error-boundary-card">
          <div className="error-boundary-icon" aria-hidden="true">⚠</div>
          <h2 className="error-boundary-title">
            {this.props.title ?? "Something went wrong"}
          </h2>
          <p className="error-boundary-message">{this.state.message}</p>
          <button
            className="btn-primary"
            onClick={this.handleReload}
            autoFocus
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
