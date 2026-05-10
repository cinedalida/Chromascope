/**
 * ProcessingAnimation — FUTURE USE (ColorAnalysisProcessingPage)
 *
 * Animated visual feedback while the backend analysis engine is running.
 * Currently ColorAnalysisProcessingPage renders this inline — extract and use this component.
 * Receives optional statusText and progress (0–100) props.
 */
export function ProcessingAnimation() {
  return (
    <div className="rounded-3xl bg-slate-900 p-6 text-center text-slate-300">
      <div className="mx-auto mb-4 h-24 w-24 animate-spin rounded-full border-8 border-purple-500 border-t-transparent" />
      <p>Analyzing tone and palette...</p>
    </div>
  );
}
