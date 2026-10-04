import { Component, Suspense } from "react";
import type { ReactNode } from "react";
import { pageWidth } from "../lib/ui";

// Shown for a moment while a page's code loads
function PageLoading() {
  return (
    <main className={`${pageWidth} py-8 space-y-6`} aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded-lg bg-ink-100 animate-pulse" />
      <div className="h-40 rounded-2xl bg-ink-100 animate-pulse" />
      <div className="h-64 rounded-2xl bg-ink-100 animate-pulse" />
    </main>
  );
}

// If a page can't load at all (for example the connection dropped), say so instead of a blank screen
class LoadError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className={`${pageWidth} py-16 text-center`}>
        <h1 className="text-xl font-semibold text-ink-900">This page didn't load</h1>
        <p className="mt-2 text-sm text-ink-500">Check your connection, then try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition"
        >
          Reload
        </button>
      </main>
    );
  }
}

// Wraps the area where pages appear, so the header and navigation stay in place while one loads
function PageBoundary({ children }: { children: ReactNode }) {
  return (
    <LoadError>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </LoadError>
  );
}

export default PageBoundary;
