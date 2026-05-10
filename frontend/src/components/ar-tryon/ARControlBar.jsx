/**
 * ARControlBar — FUTURE USE (ARTryOnPage)
 *
 * Bottom control bar for the live AR camera view: Capture, Reset, and Compare actions.
 * Replaces the inline control buttons in ARTryOnPage once the real AR pipeline is implemented.
 * Pairs with useARCamera hook for camera state management.
 */
export function ARControlBar() {
  return (
    <div className="rounded-3xl bg-slate-950 p-4 text-slate-300 flex items-center justify-between">
      <button className="rounded-full bg-slate-800 px-4 py-2">Capture</button>
      <button className="rounded-full bg-purple-600 px-4 py-2">Reset</button>
    </div>
  );
}
