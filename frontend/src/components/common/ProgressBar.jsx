/**
 * ProgressBar — FUTURE USE (ColorAnalysisProcessingPage / OnboardingPage)
 *
 * Visual percentage-fill bar for multi-step progress indicators.
 * Use in ColorAnalysisProcessingPage (analysis step progress) and OnboardingPage (profile completion).
 * Accepts `progress` (0–100), optional `color`, and `label` props.
 */
export function ProgressBar({ progress = 0 }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full bg-purple-500" style={{ width: `${progress}%` }} />
    </div>
  );
}
