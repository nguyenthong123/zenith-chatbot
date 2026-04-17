"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ChatErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Something went wrong while rendering this content.
          </p>
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
            onClick={() => this.setState({ hasError: false, error: null })}
            type="button"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
