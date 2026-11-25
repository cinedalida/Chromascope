/**
 * Small synthetic clips in the recorder's format, built in memory for the replay tests.
 * NOT real data: seeded fake faces with a known movement. 478 points, normalized coordinates.
 */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function syntheticClip({ researcher = "R2", scenario = "slowTurn", lighting = "bright", seed = 1, frames = 90, gapAt = null } = {}) {
  const rand = prng(seed);
  const base = Array.from({ length: 478 }, () => [0.35 + rand() * 0.3, 0.35 + rand() * 0.3, (rand() - 0.5) * 0.05]);
  base[33] = [0.42, 0.45, 0];
  base[263] = [0.58, 0.45, 0];
  const out = [];
  let t = 0;
  for (let f = 0; f < frames; f++) {
    const dx = scenario === "still" ? 0 : 0.05 * Math.sin((2 * Math.PI * t) / 1500);
    const missing = gapAt !== null && f >= gapAt && f < gapAt + 3;
    const points = missing ? null : base.map(([x, y, z]) => [x + dx + (rand() - 0.5) * 0.003, y + (rand() - 0.5) * 0.003, z]);
    out.push({ t, points });
    t += 33.33 + (rand() - 0.5) * 4;
  }
  const clipId = `${researcher}-${scenario}-${lighting}-synthetic${seed}`;
  return { clipId, researcher, scenario, lighting, device: "synthetic", videoWidth: 1280, videoHeight: 720, recordedAt: "2026-11-25T00:00:00.000Z", frames: out };
}
