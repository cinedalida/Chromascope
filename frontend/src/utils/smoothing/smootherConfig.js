/**
 * Smoother selection from URL parameters (AR try-on page).
 *
 *   ?smoother=ema|oneeuro                 strategy, default ema
 *   &alpha=0.3                            EMA alpha, in (0, 1], default 0.5
 *   &minCutoff=1.0&beta=0.01&dCutoff=1.0  One Euro params, see ONE_EURO_DEFAULTS
 *
 * No parameters gives exactly the original behavior (EMA, alpha 0.5). A bad value
 * falls back to its default with a console warning.
 */
export const EMA_DEFAULTS = Object.freeze({ alpha: 0.5 });

// Placeholders until tuning (plan Phase 7); replace with the tuned values once known.
export const ONE_EURO_DEFAULTS = Object.freeze({ minCutoff: 1.0, beta: 0.0, dCutoff: 1.0 });

const RULES = {
  alpha: { ok: (v) => v > 0 && v <= 1, text: "a number in (0, 1]" },
  minCutoff: { ok: (v) => v > 0, text: "a positive number" },
  dCutoff: { ok: (v) => v > 0, text: "a positive number" },
  // 0 is allowed: it is the default and turns the One Euro filter into a fixed low-pass.
  beta: { ok: (v) => v >= 0, text: "a number of 0 or more" },
};

function readNumber(params, name, fallback) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const value = raw.trim() === "" ? NaN : Number(raw);
  if (Number.isFinite(value) && RULES[name].ok(value)) return value;
  console.warn(`[AR] Ignoring ${name}=${raw}: expected ${RULES[name].text}. Using ${fallback}.`);
  return fallback;
}

/**
 * @param {string | URLSearchParams} search  e.g. location.search
 * @returns {{ type: "ema", params: { alpha: number } } | { type: "oneeuro", params: { minCutoff: number, beta: number, dCutoff: number } }}
 */
export function parseSmootherParams(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const requested = params.get("smoother");
  let type = requested === null ? "ema" : requested.trim().toLowerCase();
  if (type !== "ema" && type !== "oneeuro") {
    console.warn(`[AR] Unknown smoother=${requested}, using ema.`);
    type = "ema";
  }

  if (type === "oneeuro") {
    return {
      type,
      params: {
        minCutoff: readNumber(params, "minCutoff", ONE_EURO_DEFAULTS.minCutoff),
        beta: readNumber(params, "beta", ONE_EURO_DEFAULTS.beta),
        dCutoff: readNumber(params, "dCutoff", ONE_EURO_DEFAULTS.dCutoff),
      },
    };
  }
  return { type, params: { alpha: readNumber(params, "alpha", EMA_DEFAULTS.alpha) } };
}

/** Short label for the performance readout, e.g. "EMA α 0.5". */
export function describeSmoother({ type, params }) {
  if (type === "oneeuro") {
    return `One Euro minCutoff ${params.minCutoff} · beta ${params.beta} · dCutoff ${params.dCutoff}`;
  }
  return `EMA α ${params.alpha}`;
}
