import { Loader2 } from "lucide-react";

/** Shown in a page's area while that page's code downloads (the sidebar and navbar around it stay on screen). */
export function RouteFallback() {
  return (
    <div data-route-fallback role="status" aria-label="Loading" className="flex min-h-[50dvh] items-center justify-center text-primary">
      <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin" />
    </div>
  );
}
