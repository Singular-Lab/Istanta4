// src/components/ErrorBoundary.tsx
import AppErrorFallback from "@/components/AppErrorFallback";
import React, { Component, ErrorInfo, ReactElement, ReactNode } from "react";

interface ErrorBoundaryProps {
  fallback?: ReactElement; // opzionale, altrimenti usiamo AppErrorFallback
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error("[ErrorBoundary] ErrorBoundary attivata! Errore:", error);
    console.error("[ErrorBoundary] Stack trace:", error.stack);
    console.error(
      "[ErrorBoundary] Questo potrebbe causare il fallback e quindi il reload della pagina"
    );
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Errore catturato da ErrorBoundary:", error);
    console.error("Stack trace:", errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props;

      if (fallback) {
        // Se qualcuno passa un fallback custom, lo clono e gli inietto `error`
        return React.cloneElement(fallback, { error: this.state.error });
      }

      // Fallback di default
      return <AppErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
