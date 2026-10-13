// Turns hex colors into a single, everyday color word for display.
// Hex values are still used everywhere for rendering — this only affects the text users read.

const SKIN_TONE_NAMES = [
  ["Porcelain", "#F2D7C9"],
  ["Ivory", "#EFD5B8"],
  ["Beige", "#E0BC98"],
  ["Sand", "#D4AA80"],
  ["Almond", "#C99E78"],
  ["Honey", "#C99862"],
  ["Rosewood", "#A8807A"],
  ["Caramel", "#B57E4E"],
  ["Tan", "#A0703F"],
  ["Bronze", "#8C5A32"],
  ["Mocha", "#6B4430"],
  ["Espresso", "#3E2A20"],
];

const COLOR_NAMES = [
  ...SKIN_TONE_NAMES,

  // Neutrals
  ["Black", "#0D0D0D"],
  ["White", "#FFFFFF"],
  ["Cream", "#FFF5DC"],
  ["Grey", "#9B9B9B"],
  ["Slate", "#708090"],
  ["Khaki", "#C4A882"],
  ["Camel", "#C19A6B"],
  ["Brown", "#8B4513"],
  ["Chocolate", "#5C2018"],

  // Reds & oranges
  ["Red", "#E63946"],
  ["Crimson", "#C0392B"],
  ["Burgundy", "#800020"],
  ["Wine", "#722F37"],
  ["Coral", "#FF6B6B"],
  ["Salmon", "#FA8072"],
  ["Peach", "#FFCBA4"],
  ["Apricot", "#FBB474"],
  ["Orange", "#FF8C42"],
  ["Rust", "#B5451B"],
  ["Terracotta", "#E07A5F"],

  // Yellows
  ["Mustard", "#E1AD01"],
  ["Gold", "#FFCC4D"],
  ["Lemon", "#FFF176"],

  // Greens & teals
  ["Mint", "#ADEFD1"],
  ["Sage", "#A7C5BD"],
  ["Jade", "#06D6A0"],
  ["Emerald", "#00A86B"],
  ["Olive", "#808000"],
  ["Forest", "#228B22"],
  ["Teal", "#2A9D8F"],
  ["Turquoise", "#40E0D0"],

  // Blues
  ["Sky", "#A8DADC"],
  ["Powder", "#B5C7D3"],
  ["Blue", "#3A86FF"],
  ["Navy", "#1C1C3A"],
  ["Midnight", "#0A0A2E"],

  // Purples & pinks
  ["Lavender", "#CBAACB"],
  ["Lilac", "#B8B0C8"],
  ["Heather", "#9B8EA0"],
  ["Mauve", "#B5838D"],
  ["Orchid", "#C77DFF"],
  ["Violet", "#8338EC"],
  ["Plum", "#4A0E4E"],
  ["Pink", "#FFCBF2"],
  ["Blush", "#F2C4CE"],
  ["Rose", "#D88090"],
  ["Raspberry", "#C94060"],
  ["Fuchsia", "#F72585"],
  ["Magenta", "#FF006E"],
];

function hexToLab(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  const channel = i => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };
  const r = channel(0), g = channel(2), b = channel(4);

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const toLabs = list => list.map(([name, hex]) => [name, hexToLab(hex)]);
const NAMED_LABS = toLabs(COLOR_NAMES);
const SKIN_TONE_LABS = toLabs(SKIN_TONE_NAMES);

function closestName(hex, namedLabs) {
  if (!hex || !/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return "";
  const [l, a, b] = hexToLab(hex);
  let best = "";
  let bestDist = Infinity;
  for (const [name, [nl, na, nb]] of namedLabs) {
    const dist = (l - nl) ** 2 + (a - na) ** 2 + (b - nb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

// Returns the closest everyday color word for a hex string, e.g. "#FF6B6B" -> "Coral".
export function getColorName(hex) {
  return closestName(hex, NAMED_LABS);
}

// Like getColorName, but only ever returns a skin-tone word, e.g. "#C8A27E" -> "Almond".
export function getSkinToneName(hex) {
  return closestName(hex, SKIN_TONE_LABS);
}
