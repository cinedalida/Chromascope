import { test, expect } from "@playwright/test";

// Catalog Phase 2 validation (PLAN_CATALOG.md): per-shade verdicts, worst-shade headline, closest-shade colour
// matching, and real catalog statistics. Emulator + local backend; a hand-made product is written with admin access.

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const API = "http://127.0.0.1:8000/api";
const DOCS = "http://127.0.0.1:8080/v1/projects/demo-chromascope/databases/(default)/documents";
const owner = { Authorization: "Bearer owner" };
const stamp = Date.now();
const str = (v) => ({ stringValue: v });
const arr = (vals) => ({ arrayValue: { values: vals } });
const num = (v) => ({ doubleValue: v });
const shade = (id, name, lab, formula) => ({ mapValue: { fields: { shade_id: str(id), name: str(name), hex: str("#c9a07b"),
  lab: arr(lab.map(num)), formula_id: str(formula) } } });

const PID = `TEST-SHADES-${stamp}`;
const LAB_B = [55.5, 14.2, 21.0];

test.describe.configure({ mode: "serial" });
let headers;

test.beforeAll(async ({ request }) => {
  await request.patch(`${DOCS}/products/${PID}`, { headers: owner, data: { fields: {
    product_id: str(PID), product_name: str("[TEST] Four-Shade Foundation"), brand: str("TestBrand"), category: str("Face"),
    full_inci_list: str("Water, Glycerin, Dimethicone"),
    formulas: { mapValue: { fields: {
      f_safe: str("Water, Glycerin, Dimethicone"),
      f_caution: str("Water, Glycerin, Parfum, Limonene, Linalool"),
      f_excl: str("Water, Glycerin, Methylparaben"),
    } } },
    shades: arr([shade("A", "Light", [80, 8, 15], "f_safe"), shade("B", "Medium", LAB_B, "f_safe"),
      shade("C", "Tan", [62, 12, 22], "f_caution"), shade("D", "Deep", [35, 15, 20], "f_excl")]),
    lab_L: num(80), lab_a: num(8), lab_b: num(15), season_tags: str(""),
  } } });
  const res = await request.post(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    data: { email: `shades-${stamp}@example.com`, password: "testpass123", returnSecureToken: true } });
  const { idToken, localId } = await res.json();
  headers = { Authorization: `Bearer ${idToken}` };
  // Sensitive + eczema (fragrance -> Caution) and a declared paraben allergy (methylparaben -> Excluded).
  await request.patch(`${DOCS}/users/${localId}`, { headers: owner, data: { fields: {
    display_name: str("Shades"), skin_type: str("Normal"), concerns: arr([str("Sensitive"), str("Eczema")]),
    avoid_ingredients: arr([str("Parabens")]), user_lab: arr(LAB_B.map(num)), seasonal_label: str("Soft Autumn"),
  } } });
});

test("each shade gets its own verdict; the product shows its worst shade", async ({ request }) => {
  const body = await (await request.post(`${API}/run-filter`, { headers, data: { category: "Face" } })).json();
  const p = body.safety_results.find((x) => x.product_id === PID);
  expect(p.verdict).toBe("excluded");
  expect(p.shade_count).toBe(4);
  expect(p.shade_verdicts).toEqual({ safe: 2, caution: 1, excluded: 1 });
  expect(Object.fromEntries(p.shades.map((s) => [s.name, s.verdict]))).toEqual(
    { Light: "safe", Medium: "safe", Tan: "caution", Deep: "excluded" });
  expect(p.flagged_ingredients.join(" ")).toMatch(/Declared allergen: Parabens \(methylparaben\)/);
});

test("face matching uses the shade closest to the user's skin", async ({ request }) => {
  const body = await (await request.post(`${API}/run-filter`, { headers, data: { category: "Face" } })).json();
  const p = body.color_matched.find((x) => x.product_id === PID);
  expect(p.best_shade?.name).toBe("Medium");          // exact LAB match with the user's skin
  expect(p.best_shade?.verdict).toBe("safe");
  expect(p.delta_e).toBeLessThan(0.01);
});

test("catalog statistics are the filter's real counts", async ({ request }) => {
  const sum = await (await request.get(`${API}/catalog/summary`, { headers })).json();
  expect(sum.filter).toBe("bayes");
  expect(sum.safe + sum.caution + sum.excluded).toBe(sum.total);
  let total = 0;
  for (const category of ["Face", "Lips", "Eyes", "Cheeks", "Concealer", "Multiuse"]) {
    total += (await (await request.post(`${API}/run-filter`, { headers, data: { category } })).json()).safety_results.length;
  }
  expect(sum.total).toBe(total);
});
