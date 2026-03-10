import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.fallbackTitle ?? "Something went wrong";

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div
          className="flex flex-col items-center text-center max-w-md p-8 rounded-xl"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ background: "rgba(220,38,38,0.1)" }}
          >
            <AlertTriangle size={24} style={{ color: "#DC2626" }} />
          </div>

          <h2
            className="text-base font-bold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>

          <p
            className="text-xs mb-6 leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            {this.state.error?.message ?? "An unexpected error occurred. Try refreshing or navigate back."}
          </p>

          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: "var(--gold-400)",
                color: "var(--surface-base)",
              }}
            >
              <RotateCcw size={13} /> Retry
            </button>
            <button
              onClick={this.handleHome}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: "var(--surface-overlay)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
              }}
            >
              <Home size={13} /> Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
