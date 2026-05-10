/**
 * ImageUploader — FUTURE USE (ColorAnalysisPage)
 *
 * Drag-and-drop / file picker for selfie upload to the color analysis flow.
 * Replaces the inline upload area currently in ColorAnalysisPage.
 * Should pass the selected File object to useColorAnalysis().analyze().
 * Also validate with utils/imagePreprocessing (applyCLAHE) before submission.
 */
export function ImageUploader() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <label className="block text-sm">Choose image
        <input type="file" className="mt-3 w-full rounded-2xl bg-slate-800 p-3 text-white" />
      </label>
    </div>
  );
}
