import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Info } from "lucide-react";
import { useARShades } from "../../hooks/useARShades.js";
import { groupByProduct, searchProducts } from "../../utils/shadeGroups.js";
import { ProductSwatchPicker } from "./ProductSwatchPicker.jsx";
import { AR_GROUPS, REGION_LABEL, groupByKey, groupOfRegion } from "../../utils/arGroups.js";

const SOURCES = [
  { key: "recommended", label: "Recommended" },
  { key: "browse", label: "Browse" },
];

const PAGE_SIZE = 12;
const PREVIEW_COUNT = 6;
const SEARCH_DELAY_MS = 150;

const EMPTY_MESSAGES = {
  signed_out: "Sign in to see products matched to you.",
  empty: "No matched products for this category yet.",
  error: "Could not load your matches.",
};

function formatPrice(price, currency) {
  if (price === null || price === undefined) return null;
  const amount = price.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  if (currency === "Peso") return `₱${amount}`;
  if (currency === "Dollar") return `$${amount}`;
  return amount;
}

/* ── Verdict badge: same colors as StatusBadge on the Ingredient Filter page ── */
function VerdictBadge({ verdict }) {
  const isSafe = verdict === "safe";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2 py-0.5 ${
        isSafe ? "bg-[#ECFDF5] border-[#D1FAE5] text-[#059669]" : "bg-[#FFFBEB] border-[#FEF3C7] text-[#D97706]"
      }`}
    >
      <span className={`h-1 w-1 rounded-full ${isSafe ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
      <span className="text-[9px] font-black uppercase tracking-widest">{isSafe ? "Safe" : "Caution"}</span>
    </span>
  );
}

function Notice({ children }) {
  return (
    <p className="rounded-xl bg-primary-lightest px-3 py-2 text-[11px] leading-snug text-primary-darker">{children}</p>
  );
}

function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[11px] text-gray-light">{message}</p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-primary transition hover:opacity-70"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Id of the selected shade in this product's region, if it came from the same source as the product.
function selectedIdFor(group, selectedShades) {
  const selected = selectedShades?.[group.region];
  return selected?.source === group.source ? selected.id : null;
}

function rowStyle(isActive) {
  return {
    backgroundColor: isActive ? "var(--color-primary-lightest)" : "#FAFAFA",
    border: isActive ? "1.5px solid #C084FC" : "1.5px solid transparent",
  };
}

/* ── Brand, name and meta line shared by both row types ── */
function ProductInfo({ group }) {
  const price = formatPrice(group.price, group.currency);
  const count = group.shades.length;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-gray-light">{group.brand}</span>
        {group.source === "recommended" && group.verdict && <VerdictBadge verdict={group.verdict} />}
      </div>
      <p className="truncate font-heading text-[13px] font-semibold leading-tight text-black">{group.product}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-light">
        {group.region && (
          <span className="rounded-md bg-gray-lightest px-1.5 py-px text-[8px] font-black uppercase tracking-wider text-black/60">
            {REGION_LABEL[group.region] ?? group.region}
          </span>
        )}
        {price && <span>{price}</span>}
        {group.finish && <span className="truncate">{group.finish}</span>}
        {count > 1 && <span>{count} shades</span>}
        {group.fitTier && (
          <span
            className={`rounded-md px-1.5 py-px text-[8px] font-black uppercase tracking-tighter ${
              group.fitTier === "great" ? "bg-[#ECFDF5] text-[#059669]" : "bg-primary-lighter text-primary"
            }`}
          >
            {group.fitTier === "great" ? "Great match" : "Good match"}
          </span>
        )}
        {group.seasonMatch && !group.fitTier && (
          <span className="rounded-md bg-primary-lighter px-1.5 py-px text-[8px] font-black uppercase tracking-tighter text-primary">
            Season match
          </span>
        )}
      </div>
    </div>
  );
}

/* ── A product with one shade: the whole row is the swatch ── */
function SingleShadeRow({ group, selectedShades, onSelect }) {
  const shade = group.shades[0];
  const isActive = shade.id === selectedIdFor(group, selectedShades);
  return (
    <button
      type="button"
      onClick={() => onSelect(group.region, isActive ? null : shade)}
      aria-pressed={isActive}
      aria-label={`${group.brand} ${group.product} ${shade.shade || ""}`.trim()}
      className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-all duration-200 hover:brightness-[0.98]"
      style={rowStyle(isActive)}
    >
      <span
        className={`h-9 w-9 shrink-0 rounded-full shadow-sm ring-offset-2 ${isActive ? "ring-2 ring-primary" : "ring-1 ring-black/10"}`}
        style={{ backgroundColor: shade.hex }}
      />
      <ProductInfo group={group} />
    </button>
  );
}

/* ── A product with many shades: collapsed shows a dot preview, expanded shows the full grid ── */
function MultiShadeRow({ group, selectedShades, onSelect, open, onToggle }) {
  const selectedId = selectedIdFor(group, selectedShades);
  const isActive = group.shades.some((shade) => shade.id === selectedId);
  const preview = group.shades.slice(0, PREVIEW_COUNT);
  const extra = group.shades.length - preview.length;

  return (
    <div className="rounded-2xl p-2.5 transition-all duration-200" style={rowStyle(isActive)}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-2 text-left">
        <ProductInfo group={group} />
        <ChevronDown
          size={16}
          className={`mt-3 shrink-0 text-gray-light transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <ProductSwatchPicker shades={group.shades} selectedId={selectedId} onSelect={(shade) => onSelect(group.region, shade)} />
      ) : (
        <button type="button" onClick={onToggle} aria-label={`Show ${group.shades.length} shades`} className="mt-2 flex items-center">
          {preview.map((shade) => (
            <span
              key={shade.id}
              className={`-mr-1 h-5 w-5 rounded-full ring-2 ${shade.id === selectedId ? "ring-primary" : "ring-white"}`}
              style={{ backgroundColor: shade.hex }}
            />
          ))}
          {extra > 0 && <span className="ml-2.5 text-[10px] font-semibold text-gray-light">+{extra}</span>}
        </button>
      )}
    </div>
  );
}

/* ── Paged row list. Remounted (keyed) when tab, source or query changes, which resets the page count
      and reopens the row that holds the selected shade. One row is open at a time. ── */
function ProductList({ groups, selectedShades, onSelect }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [openKey, setOpenKey] = useState(
    () => groups.find((group) => group.shades.some((shade) => shade.id === selectedIdFor(group, selectedShades)))?.key ?? null,
  );
  return (
    <>
      {groups.slice(0, visible).map((group) =>
        group.shades.length === 1 ? (
          <SingleShadeRow key={group.key} group={group} selectedShades={selectedShades} onSelect={onSelect} />
        ) : (
          <MultiShadeRow
            key={group.key}
            group={group}
            selectedShades={selectedShades}
            onSelect={onSelect}
            open={openKey === group.key}
            onToggle={() => setOpenKey((current) => (current === group.key ? null : group.key))}
          />
        ),
      )}
      {groups.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((n) => n + PAGE_SIZE)}
          className="w-full rounded-2xl border border-gray-lighter py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-primary transition hover:bg-primary-lightest"
        >
          Show more ({groups.length - visible} left)
        </button>
      )}
    </>
  );
}

/* ── Main panel ───────────────────────────── */
export function AppliedProductsPanel({ selectedShades, onSelectShade, onClear, initialRegion }) {
  const [activeGroup, setActiveGroup] = useState(() => groupOfRegion(initialRegion) ?? "lips");
  // Product type inside the tab ("all" or a region key such as "eyeliner"), so liner, brows and shadow don't mix.
  const [activeType, setActiveType] = useState(() => initialRegion ?? "all");
  const [source, setSource] = useState("recommended");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { items, status, loading, seasonFilter, ranked } = useARShades(activeGroup, source);
  const groups = useMemo(() => groupByProduct(items), [items]);
  const typeCounts = useMemo(() => {
    const counts = {};
    for (const group of groups) counts[group.region] = (counts[group.region] ?? 0) + 1;
    return counts;
  }, [groups]);
  const typeOptions = groupByKey(activeGroup).regions.filter((region) => typeCounts[region]);
  // A type with no products in this tab/source (e.g. after switching source) falls back to showing everything.
  const effectiveType = typeCounts[activeType] ? activeType : "all";
  const visibleGroups = useMemo(() => {
    const ofType = effectiveType === "all" ? groups : groups.filter((group) => group.region === effectiveType);
    return source === "browse" ? searchProducts(ofType, debouncedQuery) : ofType;
  }, [groups, effectiveType, source, debouncedQuery]);

  const applied = Object.entries(selectedShades).filter(([, shade]) => shade);

  const switchSource = (next) => {
    setSource(next);
    setQuery("");
    setDebouncedQuery("");
  };

  return (
    <div className="flex h-full flex-col bg-white font-body">
      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-lightest/60">
        <div className={`flex items-center justify-between ${applied.length ? "mb-2.5" : ""}`}>
          <div>
            <h2 className="font-heading text-lg font-semibold text-black leading-tight">
              Applied Products
            </h2>
            <p className="text-[11px] text-gray-light mt-0.5">
              {applied.length} active · live AR overlay
            </p>
          </div>
          <button
            onClick={onClear}
            className="relative text-[10px] font-bold uppercase tracking-[0.12em] text-primary transition hover:opacity-70 after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-['']"
          >
            Clear all
          </button>
        </div>

        {/* Applied chips, one per region, straight from selectedShades. */}
        {applied.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {applied.map(([region, shade]) => (
            <span
              key={region}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-lightest py-1 pl-1.5 pr-2 text-[11px] font-semibold text-black"
            >
              <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: shade.hex }} />
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-primary">{REGION_LABEL[region] ?? region}</span>
              <span className="truncate">
                {shade.shade || shade.product}
                <span className="font-normal text-gray-light"> · {shade.brand}</span>
              </span>
              {shade.source === "browse" && (
                <span className="rounded-md bg-white px-1.5 text-[8px] font-black uppercase tracking-wider text-gray-light">
                  Browse
                </span>
              )}
              <button
                onClick={() => onSelectShade(region, null)}
                aria-label={`Remove ${(REGION_LABEL[region] ?? region).toLowerCase()} shade`}
                className="relative opacity-60 hover:opacity-100 leading-none after:absolute after:-inset-y-4 after:-inset-x-2 after:content-['']"
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
        )}
      </div>

      {/* ── Source switch (main choice) above the region filters ── */}
      <div className="px-4 py-2.5 border-b border-gray-lightest/60 bg-white space-y-1.5">
        {/* Recommended first (R1), Browse second. Purple marks it as the main category. */}
        <div className="flex p-1 bg-primary-lighter rounded-2xl gap-1">
          {SOURCES.map(({ key, label }) => {
            const isActive = source === key;
            return (
              <button
                key={key}
                onClick={() => switchSource(key)}
                aria-pressed={isActive}
                className={`flex-1 rounded-xl py-2 text-[10px] font-bold tracking-[0.06em] transition-all duration-300 ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-primary/70 hover:text-primary hover:bg-white/50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Region filters */}
        <div className="flex p-0.5 bg-gray-lightest/60 rounded-xl gap-1">
          {AR_GROUPS.map(({ label, key }) => {
            const isActive = activeGroup === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveGroup(key);
                  setActiveType("all");
                }}
                className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold tracking-[0.1em] transition-all duration-300 ${
                  isActive
                    ? "bg-white text-primary shadow-sm ring-1 ring-black/5"
                    : "text-gray-light hover:text-gray hover:bg-black/5"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Product type inside the tab, with how many products each has */}
        {!loading && typeOptions.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Product type">
            {[["all", "All", groups.length], ...typeOptions.map((region) => [region, REGION_LABEL[region], typeCounts[region]])].map(
              ([key, label, count]) => {
                const isActive = effectiveType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveType(key)}
                    aria-pressed={isActive}
                    className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-white"
                        : "border-gray-lighter bg-white text-black/70 hover:border-primary-light"
                    }`}
                  >
                    {label} <span className={isActive ? "text-white/70" : "text-gray-light"}>{count}</span>
                  </button>
                );
              },
            )}
          </div>
        )}
      </div>

      {/* ── Product List ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {source === "browse" && (
          <div className="pb-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand, product, or shade"
              aria-label="Search Browse shades"
              className="w-full rounded-xl border border-gray-lighter bg-white px-3.5 py-2 text-[12px] text-black placeholder:text-gray-light focus:border-primary-light focus:outline-none"
            />
            <p className="mt-1.5 flex items-center gap-1 px-1 text-[10px] text-gray-light">
              <Info size={11} className="shrink-0" />
              Browse shades are not checked by the ingredient safety filter.
            </p>
          </div>
        )}

        {source === "recommended" && !loading && status === "ok" && ranked && (
          <Notice>Everything that passed your ingredient check, sorted by how well it suits your colors. Best match first.</Notice>
        )}
        {source === "recommended" && !loading && status === "ok" && !ranked && seasonFilter === "no_season" && (
          <Notice>
            <Link to="/color-analysis" className="font-bold underline">Run Color Analysis</Link> to sort these by how well they suit you.
          </Notice>
        )}
        {source === "recommended" && !loading && status === "ok" && !ranked && seasonFilter !== "no_season" && (
          <Notice>Showing everything that passed your ingredient check, safest first.</Notice>
        )}

        {loading ? (
          <p className="py-10 text-center text-[11px] text-gray-light">Loading shades…</p>
        ) : source === "recommended" && status !== "ok" ? (
          <EmptyState
            message={EMPTY_MESSAGES[status] ?? EMPTY_MESSAGES.error}
            actionLabel="Browse instead"
            onAction={() => switchSource("browse")}
          />
        ) : source === "browse" && status !== "ok" ? (
          <EmptyState message="Could not load Browse shades." />
        ) : visibleGroups.length === 0 ? (
          <EmptyState message={`No products match "${debouncedQuery}".`} />
        ) : (
          <ProductList
            key={`${activeGroup}:${effectiveType}:${source}:${debouncedQuery}`}
            groups={visibleGroups}
            selectedShades={selectedShades}
            onSelect={onSelectShade}
          />
        )}
      </div>
    </div>
  );
}
