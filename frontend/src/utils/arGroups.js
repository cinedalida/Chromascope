// The AR try-on has 13 drawable regions (see DRAW_ORDER in arRenderer.js). The panel and the control bar show them
// as four groups, which is how people think about makeup: lips, cheeks, eyes, face.
//
// `api` lists the /api/run-filter categories that supply a group's Recommended products.

export const AR_GROUPS = [
  { key: "lips", label: "LIPS", regions: ["lips", "lipLiner"], api: ["lips"] },
  { key: "cheeks", label: "CHEEKS", regions: ["cheeks", "bronzer", "contour", "highlighter"], api: ["cheeks"] },
  { key: "eyes", label: "EYES", regions: ["eyeshadow", "eyeliner", "brows", "mascara"], api: ["eyes"] },
  { key: "face", label: "FACE", regions: ["foundation", "concealer", "powder"], api: ["face", "concealer"] },
];

export const ALL_REGIONS = AR_GROUPS.flatMap((group) => group.regions);

export const REGION_LABEL = {
  lips: "Lips",
  lipLiner: "Lip liner",
  cheeks: "Blush",
  bronzer: "Bronzer",
  contour: "Contour",
  highlighter: "Highlighter",
  eyeshadow: "Eyeshadow",
  eyeliner: "Eyeliner",
  brows: "Brows",
  mascara: "Mascara",
  foundation: "Foundation",
  concealer: "Concealer",
  powder: "Powder",
};

const GROUP_OF_REGION = Object.fromEntries(AR_GROUPS.flatMap((g) => g.regions.map((region) => [region, g.key])));

export const groupOfRegion = (region) => GROUP_OF_REGION[region] ?? null;
export const groupByKey = (key) => AR_GROUPS.find((group) => group.key === key) ?? null;
