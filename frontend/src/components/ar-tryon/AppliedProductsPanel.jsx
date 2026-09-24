import { useState } from "react";

const categories = ["LIPS", "EYESHADOW", "BLUSH"];

// DUMMY DATA — placeholder applied-products list until this panel is wired
// to the real AR try-on state (live product selections / backend). Each
// item carries a `category` so the LIPS/EYESHADOW/BLUSH tabs actually filter
// the list instead of just relabeling the same five items.
const products = [
  {
    id: 1,
    category: "LIPS",
    name: "Velvet Orchid #12",
    type: "MATTE FINISH",
    description: "Full-coverage clinical pigment",
    deltaE: "0.4",
    active: true,
    gradient: "linear-gradient(135deg, #5D0E41 0%, #3A0022 100%)",
  },
  {
    id: 2,
    category: "LIPS",
    name: "Crimson Quartz",
    type: "SATIN GLOSS",
    description: "Hyaluronic-infused serum",
    deltaE: "1.2",
    active: false,
    gradient: "linear-gradient(135deg, #9C274B 0%, #7B1C39 100%)",
  },
  {
    id: 3,
    category: "LIPS",
    name: "Neon Peony",
    type: "HYDRA-SHEER",
    description: "Lightweight botanical balm",
    deltaE: "1.5",
    active: false,
    gradient: "linear-gradient(135deg, #E91E63 0%, #AD1457 100%)",
  },
  {
    id: 4,
    category: "LIPS",
    name: "Amber Sunset",
    type: "MATTE LIQUID",
    description: "All-day wear lab formula",
    deltaE: "2.1",
    active: false,
    gradient: "linear-gradient(135deg, #FF9800 0%, #E65100 100%)",
  },
  {
    id: 5,
    category: "LIPS",
    name: "Cacao Elixir",
    type: "DEEP SATIN",
    description: "Organic derived micro-pigments",
    deltaE: "0.9",
    active: false,
    gradient: "linear-gradient(135deg, #795548 0%, #3E2723 100%)",
  },
  {
    id: 6,
    category: "EYESHADOW",
    name: "Amethyst Smoke",
    type: "SHIMMER",
    description: "Pearl-finish shadow duo",
    deltaE: "0.7",
    active: false,
    gradient: "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
  },
  {
    id: 7,
    category: "EYESHADOW",
    name: "Bronze Ember",
    type: "MATTE",
    description: "Warm-tone eye pigment",
    deltaE: "1.8",
    active: false,
    gradient: "linear-gradient(135deg, #B45309 0%, #78350F 100%)",
  },
  {
    id: 8,
    category: "BLUSH",
    name: "Rose Glow Blush",
    type: "CREAM",
    description: "Blendable cheek tint",
    deltaE: "1.1",
    active: true,
    gradient: "linear-gradient(135deg, #F472B6 0%, #BE185D 100%)",
  },
  {
    id: 9,
    category: "BLUSH",
    name: "Coral Dust",
    type: "POWDER",
    description: "Buildable micronized pigment",
    deltaE: "1.4",
    active: false,
    gradient: "linear-gradient(135deg, #FB923C 0%, #C2410C 100%)",
  },
];

/* ── Color match badge — ΔE (perceptual color difference) isn't meaningful
   to most users, so it's converted to a plain-language percentage using the
   same formula as the Ingredient Filter table, for consistency. */
function MatchBadge({ deltaE }) {
  const percent = Math.max(0, 100 - parseFloat(deltaE) * 5).toFixed(0);
  const excellent = percent >= 95;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
        excellent
          ? "bg-emerald-50 text-emerald-700"
          : "bg-gray-lightest text-gray-light"
      }`}
    >
      {percent}% Match
    </span>
  );
}

/* ── iOS-style toggle ─────────────────────── */
function ToggleSwitch({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle product"
      className="relative flex h-10 w-11 shrink-0 items-center focus:outline-none border-0"
    >
      <span
        aria-hidden="true"
        className={`h-6 w-11 rounded-full transition-colors duration-200 ${
          active ? "bg-primary" : "bg-gray-lighter"
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          active ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ── Main panel ───────────────────────────── */
export function AppliedProductsPanel() {
  const [activeCategory, setActiveCategory] = useState("LIPS");
  const [productList, setProductList] = useState(products);

  const toggleProduct = (id) =>
    setProductList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
    );

  const clearAll = () =>
    setProductList((prev) => prev.map((p) => ({ ...p, active: false })));

  const activeProducts = productList.filter((p) => p.active);
  const activeCount = activeProducts.length;
  const visibleProducts = productList.filter(
    (p) => p.category === activeCategory,
  );

  return (
    <div className="flex h-full flex-col bg-white font-body">
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-lightest/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-black leading-tight">
              Applied Products
            </h2>
            <p className="text-[11px] text-gray-light mt-0.5">
              {activeCount} active · live AR overlay
            </p>
          </div>
          <button
            onClick={clearAll}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary transition hover:opacity-70"
          >
            Clear all
          </button>
        </div>

        {/* Applied chips — derived from productList so they stay in sync
            with the toggles below instead of tracking their own state. */}
        <div className="flex flex-wrap gap-1.5">
          {activeProducts.map((product) => (
            <span
              key={product.id}
              className="inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-[11px] font-semibold text-white"
              style={{ backgroundImage: product.gradient }}
            >
              {product.name}
              <button
                onClick={() => toggleProduct(product.id)}
                aria-label={`Remove ${product.name}`}
                className="opacity-60 hover:opacity-100 leading-none"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path
                    d="M1 1L4 4M4 4L7 7M4 4L7 1M4 4L1 7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* ── Category Tabs ── */}
      <div className="px-4 py-3 border-b border-gray-lightest/60 bg-white">
        <div className="flex p-1.5 bg-gray-lightest/60 rounded-2xl gap-1">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 rounded-xl py-2.5 text-[10px] font-bold tracking-[0.1em] transition-all duration-300 ${
                  isActive
                    ? "bg-white text-primary shadow-sm ring-1 ring-black/5"
                    : "text-gray-light hover:text-gray hover:bg-black/5"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Product List ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visibleProducts.length === 0 ? (
          <p className="py-10 text-center text-[11px] text-gray-light">
            No products applied in this category yet.
          </p>
        ) : (
          visibleProducts.map((product) => (
            <div
              key={product.id}
              className="group flex items-center gap-3 rounded-2xl p-3.5 transition-all duration-200"
              style={{
                backgroundColor: product.active ? "#FAF4FF" : "#FAFAFA",
                border: product.active
                  ? "1.5px solid #C084FC"
                  : "1.5px solid transparent",
              }}
            >
              {/* Swatch */}
              <div
                className="h-12 w-12 flex-shrink-0 rounded-xl shadow-sm"
                style={{
                  background: product.gradient,
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.08)",
                }}
              />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-light">
                    {product.type}
                  </span>
                  <MatchBadge deltaE={product.deltaE} />
                </div>
                <p className="font-heading text-sm font-semibold text-black truncate leading-tight">
                  {product.name}
                </p>
                <p className="text-[11px] text-gray-light mt-0.5 truncate">
                  {product.description}
                </p>
              </div>

              {/* Toggle */}
              <ToggleSwitch
                active={product.active}
                onToggle={() => toggleProduct(product.id)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
