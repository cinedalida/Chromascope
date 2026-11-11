import { useEffect, useRef, useState } from "react";
import { REGION_LABEL } from "../../utils/arGroups";
import { ShadeDot } from "../common/ShadeDot.jsx";

const MAX_NAME = 40;

/**
 * SaveLookDialog (Part B, Phase F4): names and saves the shades on the face as a look. The name field starts with the
 * next default name ("Look 1", "Look 2", ...) selected, so typing replaces it. Names are trimmed, at most 40
 * characters, plain text only; a blank name falls back to the default. Only references are saved (F-R1), never the
 * capture image (F-R2). When the shades came from a saved look and were changed, the user chooses between updating
 * that look and saving a new one.
 */
export function SaveLookDialog({ shades, defaultName, activeLook, changed, onSave, onUpdate, onCancel }) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const run = async (action) => {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e?.code ? e.message : "Couldn't save the look. Try again.");
      setSaving(false);
    }
  };
  const save = (e) => {
    e?.preventDefault();
    run(() => onSave(name.trim() || defaultName));
  };

  return (
    <div className="fixed inset-0 z-500 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-look-title"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
      >
        <h2 id="save-look-title" className="font-heading text-lg font-semibold">
          Save look
        </h2>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-gray">Name</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
            maxLength={MAX_NAME}
            className="w-full rounded-xl border border-primary-lighter px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <ul aria-label="Shades in this look" className="max-h-56 space-y-2 overflow-y-auto">
          {shades.map(([region, shade]) => (
            <li key={region} className="flex items-center gap-2.5 text-sm">
              <ShadeDot aria-hidden="true" hex={shade.hex} className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10" />
              <span className="w-20 shrink-0 text-xs font-semibold text-gray">{REGION_LABEL[region] ?? region}</span>
              <span className="min-w-0 truncate">
                {shade.product}
                {shade.shade ? <span className="text-gray"> · {shade.shade}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-semibold text-gray hover:bg-gray-lightest">
            Cancel
          </button>
          {activeLook && changed ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => run(onUpdate)}
                className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
              >
                Update &quot;{activeLook.name}&quot;
              </button>
              <button type="submit" disabled={saving} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Save as new
              </button>
            </>
          ) : (
            <button type="submit" disabled={saving} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Save
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
