/**
 * SeasonResult — FUTURE USE (ColorAnalysisPage)
 *
 * Displays the identified season (e.g. "Deep Winter") along with AI confidence score.
 * Receives `season`, `confidence`, and `description` props from the analysis result.
 * Replaces the hardcoded result block currently in ColorAnalysisPage.
 */
export function SeasonResult() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <h3 className="text-xl font-semibold text-purple-100">Season result</h3>
      <p className="mt-2">Your best palette is cool and muted.</p>
    </div>
  );
}
