/**
 * First-order low-pass filter used by the One Euro filter (Casiez, Roussel, & Vogel, 2012).
 *
 *   alpha(cutoff, dt) = 1 / (1 + tau / dt),   tau = 1 / (2 * PI * cutoff)
 *   lowpass(value, a, prev) = a * value + (1 - a) * prev
 *
 * cutoff is in Hz and dt in seconds. A higher cutoff (or a longer dt) gives an alpha
 * closer to 1, so the output follows the input more closely.
 */

/** Smoothing factor for a given cutoff frequency (Hz) and time step (s). */
export function smoothingAlpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/** One low-pass step: blends the new value with the previous filtered value. */
export function lowpass(value, a, prev) {
  return a * value + (1 - a) * prev;
}

/**
 * Single-value low-pass filter with its own state. OneEuroSmoother keeps its state in
 * typed arrays for speed and calls the functions above directly; this class is for
 * filtering one signal at a time.
 */
export class LowPassFilter {
  constructor() {
    this.reset();
  }

  /** Filters value with factor a. The first value after a reset passes through. */
  filter(value, a) {
    this.prev = this.initialized ? lowpass(value, a, this.prev) : value;
    this.initialized = true;
    return this.prev;
  }

  reset() {
    this.prev = 0;
    this.initialized = false;
  }
}
