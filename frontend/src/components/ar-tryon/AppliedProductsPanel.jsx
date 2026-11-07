import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useARShades } from "../../hooks/useARShades.js";
import { groupByProduct, searchProducts } from "../../utils/shadeGroups.js";
import { ProductSwatchPicker } from "./ProductSwatchPicker.jsx";

// Tab label -> AR region key.
const categories = [
  { label: "LIPS", region: "lips" },
  { label: "EYESHADOW", region: "eyeshadow" },
  { label: "BLUSH", region: "cheeks" },
];
const REGION_LABEL = Object.fromEntries(categories.map((c) => [c.region, c.label]));

const SOURCES = [
  { key: "recommended", label: "Recommended" },
  { key: "browse", label: "Browse" },
];

const PAGE_SIZE = 20;
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

/* ── One product with its swatch row ── */
function ProductCard({ group, selected, onSelect }) {
  const selectedId = selected?.source === group.source ? selected.id : null;
  const isActive = group.shades.some((shade) => shade.id === selectedId);
  const price = formatPrice(group.price, group.currency);

  return (
    <div
      className="rounded-2xl p-3.5 transition-all duration-200"
      style={{
        backgroundColor: isActive ? "var(--color-primary-lightest)" : "#FAFAFA",
        border: isActive ? "1.5px solid #C084FC" : "1.5px solid transparent",
      }}
    >
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-gray-light">{group.brand}</span>
        {group.source === "recommended" && group.verdict && <VerdictBadge verdict={group.verdict} />}
      </div>
      <p className="font-heading text-sm font-semibold leading-tight text-black">{group.product}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-light">
        {price && <span>{price}</span>}
        {group.finish && <span>{group.finish}</span>}
        {group.source === "browse" && <span>{group.shades.length} {group.shades.length === 1 ? "shade" : "shades"}</span>}
        {group.seasonMatch && (
          <span className="rounded-md bg-primary-lighter px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter text-primary">
            Season match
          </span>
        )}
      </div>
      <ProductSwatchPicker shades={group.shades} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

/* ── Paged card list. Remounted (keyed) when tab, source or query changes, which resets the page count. ── */
function ProductList({ groups, selected, onSelect }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  return (
    <>
      {groups.slice(0, visible).map((group) => (
        <ProductCard key={group.key} group={group} selected={selected} onSelect={onSelect} />
      ))}
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
export function AppliedProductsPanel({ selectedShades, onSelectShade, onClear }) {
  const [activeRegion, setActiveRegion] = useState("lips");
  const [source, setSource] = useState("recommended");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { items, status, loading, seasonFilter } = useARShades(activeRegion, source);
  const groups = useMemo(() => groupByProduct(items), [items]);
  const visibleGroups = useMemo(
    () => (source === "browse" ? searchProducts(groups, debouncedQuery) : groups),
    [groups, source, debouncedQuery],
  );

  const applied = Object.entries(selectedShades).filter(([, shade]) => shade);
  const selected = selectedShades[activeRegion];
  const selectForRegion = (shade) => onSelectShade(activeRegion, shade);

  const switchSource = (next) => {
    setSource(next);
    setQuery("");
    setDebouncedQuery("");
  };

  return (
    <div className="flex h-full flex-col bg-white font-body">
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-lightest/60">
        <div className="flex items-center justify-between mb-3">
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
        <div className="flex flex-wrap gap-1.5">
          {applied.map(([region, shade]) => (
            <span
              key={region}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-lightest py-1 pl-1.5 pr-2 text-[11px] font-semibold text-black"
            >
              <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: shade.hex }} />
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
                aria-label={`Remove ${REGION_LABEL[region].toLowerCase()} shade`}
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
      </div>

      {/* ── Category Tabs ── */}
      <div className="px-4 py-3 border-b border-gray-lightest/60 bg-white space-y-2">
        <div className="flex p-1.5 bg-gray-lightest/60 rounded-2xl gap-1">
          {categories.map(({ label, region }) => {
            const isActive = activeRegion === region;
            return (
              <button
                key={region}
                onClick={() => setActiveRegion(region)}
                className={`flex-1 rounded-xl py-2.5 text-[10px] font-bold tracking-[0.1em] transition-all duration-300 ${
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

        {/* Source switch: Recommended first (R1), Browse second. */}
        <div className="flex p-1 bg-gray-lightest/60 rounded-xl gap-1">
          {SOURCES.map(({ key, label }) => {
            const isActive = source === key;
            return (
              <button
                key={key}
                onClick={() => switchSource(key)}
                aria-pressed={isActive}
                className={`flex-1 rounded-lg py-2 text-[10px] font-bold tracking-[0.06em] transition-all duration-300 ${
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
      </div>

      {/* ── Product List ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {source === "browse" && (
          <>
            <Notice>Browse shades are not checked by the ingredient safety filter.</Notice>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand, product, or shade"
              aria-label="Search Browse shades"
              className="w-full rounded-xl border border-gray-lighter bg-white px-3.5 py-2.5 text-[12px] text-black placeholder:text-gray-light focus:border-primary-light focus:outline-none"
            />
          </>
        )}

        {source === "recommended" && !loading && status === "ok" && seasonFilter === "fallback" && (
          <Notice>Showing everything that passed your ingredient check.</Notice>
        )}
        {source === "recommended" && !loading && status === "ok" && seasonFilter === "no_season" && (
          <Notice>
            <Link to="/color-analysis" className="font-bold underline">Run Color Analysis</Link> to see shades for your season.
          </Notice>
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
            key={`${activeRegion}:${source}:${debouncedQuery}`}
            groups={visibleGroups}
            selected={selected}
            onSelect={selectForRegion}
          />
        )}
      </div>
    </div>
  );
}
