import { Component } from "react";
import { isChunkLoadError } from "../../utils/lazyWithRetry";

/**
 * Catches a page that fails to load or to render, so the rest of the app (navigation) stays usable and the person gets a
 * way out instead of a blank screen. The usual cause is an old tab after a new deploy: its page code no longer exists.
 */
export class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Page failed to load or render:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const download = isChunkLoadError(error);
    return (
      <div role="alert" className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h2 className="font-heading text-lg font-semibold text-black">{download ? "This page couldn't load" : "Something went wrong"}</h2>
        <p className="text-sm text-gray">
          {download
            ? "A new version of Chromascope may be available, or your connection dropped. Reload to continue."
            : "Reload the page to try again."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Reload
        </button>
      </div>
    );
  }
}
