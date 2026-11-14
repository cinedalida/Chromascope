import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SafetyBadge } from "./SafetyBadge.jsx";

// What each safety verdict means, in the same order and labels as the badges on the cards (plan rule C1).
const STATUSES = [
  { verdict: "safe", text: "Good to go. Nothing in this product is a concern for your skin." },
  {
    verdict: "caution",
    text: "Mostly safe to use, but watch out. Something in this product may not agree with your skin. Try a small patch test first.",
  },
  {
    verdict: "excluded",
    text: "Best to skip. This product contains something you said to avoid, or something likely to irritate your skin.",
  },
];

/**
 * SafetyStatusGuide: explains the Safe, Caution and Excluded badges. Escape, the close button or the backdrop close
 * it. A bottom sheet on phones, a centered dialog from sm up.
 */
export function SafetyStatusGuide({ onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-500 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-guide-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="safety-guide-title" className="font-heading text-lg font-semibold">
            What Status Means
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-2 rounded-full p-2 text-gray hover:bg-gray-lightest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <dl className="mt-4 space-y-4">
          {STATUSES.map(({ verdict, text }) => (
            <div key={verdict}>
              <dt>
                <SafetyBadge verdict={verdict} />
              </dt>
              <dd className="mt-1.5 text-sm text-gray">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
