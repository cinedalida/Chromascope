/**
 * ConsentNotice — FUTURE USE (AuthPage / DataEthicsPage)
 *
 * Inline notice component summarizing Chromascope's data privacy and AI usage policy.
 * Embed in AuthPage or OnboardingPage alongside user consent toggles.
 * Should link to the full DataEthicsPage for extended reading.
 */
export function ConsentNotice() {
  return (
    <div className="rounded-3xl border border-purple-700/40 bg-slate-900 p-5 text-slate-300">
      <h2 className="text-lg font-semibold text-purple-100">Data ethics notice</h2>
      <p className="mt-3 text-sm">Chromascope protects your image data and only uses it for personalized cosmetic guidance.</p>
    </div>
  );
}
