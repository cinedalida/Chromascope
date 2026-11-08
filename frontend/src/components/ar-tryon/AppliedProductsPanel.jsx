import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Info, Palette, Search, ShieldCheck, X } from "lucide-react";
import { useARShades } from "../../hooks/useARShades.js";
import { groupByProduct, searchProducts, shortShadeName } from "../../utils/shadeGroups.js";
import { ProductSwatchPicker, ShadeFavoriteButton } from "./ProductSwatchPicker.jsx";
import { AR_GROUPS, REGION_LABEL, groupByKey, groupOfRegion } from "../../utils/arGroups.js";
import { selectedShadesToItems, useFavorites } from "../../hooks/useFavorites.js";
import { SaveLookDialog } from "../favorites/SaveLookDialog.jsx";

// A look's items as comparable keys, so "changed since it was loaded" ignores field order.
const itemKeys = (items) => (items || []).map((i) => `${i.region}|${i.source}|${i.product_id}|${i.shade_id}`).sort().join(",");

const SOURCES = [
  { key: "recommended", label: "Recommended" },
  { key: "browse", label: "Browse" },
];

// Basic shows one everyday product type per tab; Advanced shows every type with a type filter.
const MODES = [
  { key: "basic", label: "Basic" },
  { key: "advanced", label: "Advanced" },
];
const BASIC_TYPE = { lips: "lips", cheeks: "cheeks", eyes: "eyeshadow", face: "foundation" };
const BASIC_REGIONS = new Set(Object.values(BASIC_TYPE));
const MODE_STORAGE_KEY = "chromascope.arPanelMode";

const PAGE_SIZE = 12;
const SEARCH_DELAY_MS = 150;

const EMPTY_MESSAGES = {
  signed_out: "Sign in to see products matched to you.",
  empty: "No matched products for this category yet.",
  error: "Could not load your matches.",
};

// Hides a sideways-scrolling row's scrollbar while keeping it scrollable.
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function readStoredMode() {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "advanced" ? "advanced" : "basic";
  } catch {
    return "basic";
  }
}

function storeMode(mode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Storage blocked (private mode): the choice just isn't remembered.
  }
}

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
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px ${
        isSafe ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FFFBEB] text-[#D97706]"
      }`}
    >
      <span className={`h-1 w-1 rounded-full ${isSafe ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
      <span className="text-[9px] font-bold uppercase tracking-wider">{isSafe ? "Safe" : "Caution"}</span>
    </span>
  );
}

function MatchBadge({ group }) {
  if (group.fitTier) {
    const great = group.fitTier === "great";
    return (
      <span
        className={`shrink-0 rounded-md px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${
          great ? "bg-[#ECFDF5] text-[#059669]" : "bg-primary-lighter text-primary"
        }`}
      >
        {great ? "Great match" : "Good match"}
      </span>
    );
  }
  if (group.seasonMatch) {
    return (
      <span className="shrink-0 rounded-md bg-primary-lighter px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-primary">
        Season match
      </span>
    );
  }
  return null;
}

// One short note at the top of the list, same look on Recommended and Browse.
function Notice({ icon: Icon, iconClass, children }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-gray-lightest/70 px-3 py-2 text-[11px] leading-snug text-gray">
      <Icon aria-hidden="true" size={14} strokeWidth={2.25} className={`shrink-0 ${iconClass}`} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-xs text-gray-light">{message}</p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-primary transition hover:opacity-70"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ── Small segmented switch (Basic / Advanced) ── */
function ModeSwitch({ mode, onChange }) {
  return (
    <div className="flex shrink-0 rounded-full bg-gray-lightest p-0.5" role="group" aria-label="Product detail">
      {MODES.map(({ key, label }) => {
        const isActive = mode === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={isActive}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              isActive ? "bg-white text-primary shadow-sm ring-1 ring-black/5" : "text-gray-light hover:text-gray"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Id of the selected shade in this product's region, if it came from the same source as the product.
function selectedIdFor(group, selectedShades) {
  const selected = selectedShades?.[group.region];
  return selected?.source === group.source ? selected.id : null;
}

/* ── One product: brand and badges, name with price and shade count, then a one-tap swatch strip.
      Same layout for single-shade and multi-shade products. `showType` adds the type tag (only on "All"). ── */
function ProductRow({ group, selectedShades, onSelect, showType }) {
  const selectedId = selectedIdFor(group, selectedShades);
  const isActive = group.shades.some((shade) => shade.id === selectedId);
  const price = formatPrice(group.price, group.currency);
  const count = group.shades.length;
  const meta = [price, count > 1 ? `${count} shades` : null].filter(Boolean).join(" · ");
  const isRecommended = group.source === "recommended";
  return (
    <div className={`px-4 py-3 transition-colors duration-200 sm:px-5 ${isActive ? "bg-primary-lightest" : ""}`}>
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-gray-light">{group.brand}</span>
        {isRecommended && group.verdict && <VerdictBadge verdict={group.verdict} />}
        {isRecommended && <MatchBadge group={group} />}
      </div>
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 truncate font-heading text-sm font-semibold leading-snug text-black">{group.product}</p>
        {meta && <span className="shrink-0 text-[11px] text-gray-light">{meta}</span>}
      </div>
      {(showType || group.finish) && (
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-gray-light">
          {showType && group.region && (
            <span className="shrink-0 rounded-md bg-gray-lightest px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-black/60">
              {REGION_LABEL[group.region] ?? group.region}
            </span>
          )}
          {group.finish && <span className="truncate">{group.finish}</span>}
        </div>
      )}
      <ProductSwatchPicker shades={group.shades} selectedId={selectedId} onSelect={(shade) => onSelect(group.region, shade)} />
    </div>
  );
}

/* ── Recommended product: one shade each, so a compact card. The whole card is one button: tap to apply the shade,
      tap again to remove it. Inner parts are spans (a button holds phrasing content only). The heart is a separate
      button over the top-right corner, since a button cannot hold another. `showType` adds the type tag (only on
      "All"). ── */
function RecommendedCard({ group, selectedShades, onSelect, showType }) {
  const shade = group.shades[0];
  const isSelected = shade.id === selectedIdFor(group, selectedShades);
  const price = formatPrice(group.price, group.currency);
  const fullName = shade.shade || shade.product;
  const hasBadges = group.verdict || group.fitTier || group.seasonMatch;
  return (
    <div className="relative h-full min-w-0">
      <button
        type="button"
        onClick={() => onSelect(group.region, isSelected ? null : shade)}
        aria-pressed={isSelected}
        aria-label={`${fullName}, ${group.brand} ${group.product}`}
        title={fullName}
        className={`group flex h-full w-full flex-col rounded-2xl p-3 text-left ring-1 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isSelected ? "bg-primary-lightest ring-primary" : "bg-white ring-gray-lightest hover:ring-primary-light"
        }`}
      >
        {/* The shade first: the same round swatch as Browse, and its name (room kept for the heart when applied). */}
        <span className={`flex w-full items-center gap-2 ${isSelected ? "pr-7" : ""}`}>
          <span
            aria-hidden="true"
            className={`block h-8 w-8 shrink-0 rounded-full ring-offset-2 transition-transform duration-150 group-hover:scale-110 ${
              isSelected ? "ring-2 ring-primary" : "ring-1 ring-black/5"
            }`}
            style={{ backgroundColor: shade.hex }}
          />
          <span className="line-clamp-2 min-w-0 flex-1 font-heading text-[13px] leading-snug font-semibold text-black">
            {shortShadeName(fullName)}
          </span>
        </span>

        {/* Then the product, quieter */}
        <span className="mt-2.5 block w-full truncate text-[10px] font-bold uppercase tracking-[0.12em] text-gray-light">{group.brand}</span>
        <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray">{group.product}</span>
        {hasBadges && (
          <span className="mt-2 flex flex-wrap gap-1">
            {group.verdict && <VerdictBadge verdict={group.verdict} />}
            <MatchBadge group={group} />
          </span>
        )}
        {/* Bottom row: type tag on the left, price on the right. */}
        {((showType && group.region) || price) && (
          <span className="mt-auto flex w-full min-w-0 items-center justify-between gap-2 pt-2.5">
            {showType && group.region ? (
              <span className="shrink-0 rounded-md bg-gray-lightest px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-black/60">
                {REGION_LABEL[group.region] ?? group.region}
              </span>
            ) : (
              <span aria-hidden="true" />
            )}
            {price && <span className="truncate text-xs font-semibold text-black">{price}</span>}
          </span>
        )}
      </button>
      {isSelected && (
        <span className="absolute top-4 right-3">
          <ShadeFavoriteButton shade={shade} />
        </span>
      )}
    </div>
  );
}

/* ── Paged list: rows on Browse, a two-column card grid on Recommended. Remounted (keyed) when tab, type, source or
      query changes, which resets the page count. The next page loads when "Show more" scrolls into view, or on tap. ── */
function ProductList({ groups, selectedShades, onSelect, showType, asCards }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const moreRef = useRef(null);
  const hasMore = groups.length > visible;

  useEffect(() => {
    const el = moreRef.current;
    if (!hasMore || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible((n) => n + PAGE_SIZE);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visible]);

  return (
    <>
      {asCards ? (
        // One column on very narrow phones (under 360px), where two cards would be about 138px wide.
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3 min-[360px]:grid-cols-2 sm:px-5">
          {groups.slice(0, visible).map((group) => (
            <RecommendedCard key={group.key} group={group} selectedShades={selectedShades} onSelect={onSelect} showType={showType} />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-gray-lightest">
          {groups.slice(0, visible).map((group) => (
            <ProductRow key={group.key} group={group} selectedShades={selectedShades} onSelect={onSelect} showType={showType} />
          ))}
        </div>
      )}
      {hasMore && (
        <div className="px-4 py-3 sm:px-5">
          <button
            ref={moreRef}
            type="button"
            onClick={() => setVisible((n) => n + PAGE_SIZE)}
            className="w-full rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary transition hover:bg-primary-lightest"
          >
            Show more ({groups.length - visible} left)
          </button>
        </div>
      )}
    </>
  );
}

/* ── Main panel ───────────────────────────── */
export function AppliedProductsPanel({ selectedShades, onSelectShade, onClear, initialRegion, activeLook, onActiveLookChange }) {
  const [activeGroup, setActiveGroup] = useState(() => groupOfRegion(initialRegion) ?? "lips");
  // Arriving with an Advanced-only product (e.g. eyeliner) opens Advanced so that product is listed.
  const [mode, setMode] = useState(() =>
    initialRegion && !BASIC_REGIONS.has(initialRegion) ? "advanced" : readStoredMode(),
  );
  // Product type inside the tab in Advanced ("all" or a region key such as "eyeliner").
  const [activeType, setActiveType] = useState(() => initialRegion ?? "all");
  const [source, setSource] = useState("recommended");
  const [searchOpen, setSearchOpen] = useState(false);
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
  const isBasic = mode === "basic";
  const typeOptions = groupByKey(activeGroup).regions.filter((region) => typeCounts[region]);
  // Basic: always the tab's everyday type. Advanced: the chosen type, or everything when it has no products here.
  const effectiveType = isBasic ? BASIC_TYPE[activeGroup] : typeCounts[activeType] ? activeType : "all";
  const visibleGroups = useMemo(() => {
    const ofType = effectiveType === "all" ? groups : groups.filter((group) => group.region === effectiveType);
    return source === "browse" ? searchProducts(ofType, debouncedQuery) : ofType;
  }, [groups, effectiveType, source, debouncedQuery]);

  const applied = Object.entries(selectedShades).filter(([, shade]) => shade);

  // Save look (Part B, Phase F4): only references to the shades on the face, never the capture image. When the
  // shades came from a saved look, its name shows here and can be renamed; once changed, saving offers
  // "Update" or "Save as new".
  const { signedIn, favorites, saveLook, updateLook, renameLook } = useFavorites();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [lookName, setLookName] = useState("");
  const currentItems = selectedShadesToItems(selectedShades);
  const lookChanged = Boolean(activeLook) && itemKeys(currentItems) !== itemKeys(activeLook.items);
  const nextLookName = `Look ${favorites.filter((f) => f.type === "look").length + 1}`;
  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(false), 6000);
    return () => clearTimeout(timer);
  }, [saved]);
  const saveAsNew = async (name) => {
    const look = await saveLook(name, currentItems);
    onActiveLookChange?.({ id: look.id, name: look.name, items: look.items });
    setSaveOpen(false);
    setSaved(true);
  };
  const updateActive = async () => {
    await updateLook(activeLook.id, currentItems);
    onActiveLookChange?.({ ...activeLook, items: currentItems });
    setSaveOpen(false);
    setSaved(true);
  };
  const submitRename = (e) => {
    e.preventDefault();
    const name = lookName.trim().slice(0, 40) || activeLook.name;
    renameLook(activeLook.id, name);
    onActiveLookChange?.({ ...activeLook, name });
    setRenaming(false);
  };

  const clearSearch = () => {
    setQuery("");
    setDebouncedQuery("");
  };
  const switchSource = (next) => {
    setSource(next);
    setSearchOpen(false);
    clearSearch();
  };
  const toggleSearch = () => {
    if (searchOpen) clearSearch();
    setSearchOpen(!searchOpen);
  };
  const switchMode = (next) => {
    setMode(next);
    storeMode(next);
  };

  const notesReady = !loading && status === "ok";

  return (
    // Phones: the whole panel scrolls (title and "On your face" scroll away, the tabs and filters stick).
    // From sm: only the product list scrolls.
    <div className="flex h-full flex-col bg-white font-body max-sm:overflow-y-auto">
      {/* ── Header: title and Basic/Advanced, then the "On your face" card when shades are applied ── */}
      <div className="px-4 pt-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold leading-tight text-black">Shades</h2>
          <ModeSwitch mode={mode} onChange={switchMode} />
        </div>

        {(applied.length > 0 || activeLook || saved) && (
          <div className="mt-3 space-y-2 rounded-2xl border border-gray-lightest bg-gray-lightest/40 p-2.5 sm:space-y-2.5 sm:p-3">
            {/* Card header: the loaded look's name (renamable) or "On your face", and Clear all */}
            <div className="flex min-h-6 items-center gap-2 text-xs">
              {activeLook && renaming ? (
                <form onSubmit={submitRename} className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    value={lookName}
                    onChange={(e) => setLookName(e.target.value.slice(0, 40))}
                    maxLength={40}
                    aria-label="Look name"
                    autoFocus
                    className="min-w-0 flex-1 rounded-full border border-primary-lighter bg-white px-3 py-1 text-xs focus:border-primary focus:outline-none"
                  />
                  <button type="submit" className="shrink-0 font-semibold text-primary">
                    Save
                  </button>
                </form>
              ) : activeLook ? (
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-gray">
                  Look: <span className="truncate font-semibold text-black">{activeLook.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLookName(activeLook.name);
                      setRenaming(true);
                    }}
                    className="shrink-0 font-semibold text-primary hover:opacity-70"
                  >
                    Rename
                  </button>
                </span>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-gray-light">
                  On your face{applied.length > 0 ? ` · ${applied.length}` : ""}
                </span>
              )}
              {/* Phones: a small Save look pill here instead of the full-width button below. */}
              {signedIn && applied.length > 0 && !renaming && (
                <button
                  type="button"
                  onClick={() => setSaveOpen(true)}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-1 sm:hidden"
                >
                  <Bookmark aria-hidden="true" size={12} strokeWidth={2.25} />
                  Save look
                </button>
              )}
              {applied.length > 0 && !renaming && (
                <button
                  type="button"
                  onClick={onClear}
                  className="relative shrink-0 text-[11px] font-semibold text-gray transition hover:text-black after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']"
                >
                  Clear all
                </button>
              )}
            </div>

            {applied.length > 0 && (
              <div className={`-mx-3 flex gap-1.5 overflow-x-auto px-3 ${NO_SCROLLBAR}`}>
                {applied.map(([region, shade]) => (
                  <span
                    key={region}
                    title={shade.shade || shade.product}
                    className="inline-flex max-w-56 shrink-0 items-center gap-1.5 rounded-full bg-white py-1 pr-2.5 pl-1 text-[11px] text-black shadow-sm ring-1 ring-black/5"
                  >
                    <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: shade.hex }} />
                    <span className="shrink-0 text-[10px] font-bold text-primary">{REGION_LABEL[region] ?? region}</span>
                    <span className="truncate font-medium">{shortShadeName(shade.shade || shade.product)}</span>
                    <button
                      type="button"
                      onClick={() => onSelectShade(region, null)}
                      aria-label={`Remove ${(REGION_LABEL[region] ?? region).toLowerCase()} shade`}
                      className="relative ml-0.5 shrink-0 leading-none opacity-50 hover:opacity-100 after:absolute after:-inset-y-4 after:-inset-x-2 after:content-['']"
                    >
                      <X size={10} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {signedIn && applied.length > 0 && !renaming && (
              <button
                type="button"
                onClick={() => setSaveOpen(true)}
                className="hidden w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2 sm:flex"
              >
                <Bookmark aria-hidden="true" size={14} strokeWidth={2.25} />
                Save look
              </button>
            )}
            {saved && (
              <p role="status" className="text-center text-xs text-primary-darker">
                Saved to Favorites.{" "}
                <Link to="/favorites?tab=looks" className="font-semibold underline">
                  See your looks
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      {saveOpen && (
        <SaveLookDialog
          shades={applied}
          defaultName={nextLookName}
          activeLook={activeLook}
          changed={lookChanged}
          onSave={saveAsNew}
          onUpdate={updateActive}
          onCancel={() => setSaveOpen(false)}
        />
      )}

      {/* Tabs and filters: stick to the top of the panel on phones while the list scrolls under them. */}
      <div className="bg-white max-sm:sticky max-sm:top-0 max-sm:z-10">
      {/* ── Region tabs: text with an underline on the active tab ── */}
      <div className="mt-2 flex border-b border-gray-lightest px-2 sm:px-3">
        {AR_GROUPS.map(({ label, key }) => {
          const isActive = activeGroup === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveGroup(key);
                setActiveType("all");
              }}
              aria-pressed={isActive}
              className={`relative flex-1 py-2.5 text-[13px] font-semibold capitalize transition-colors ${
                isActive ? "text-primary" : "text-gray-light hover:text-gray"
              }`}
            >
              {label.toLowerCase()}
              <span
                aria-hidden="true"
                className={`absolute inset-x-1/4 -bottom-px h-0.5 rounded-full bg-primary transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}
              />
            </button>
          );
        })}
      </div>

      {/* ── Source toggle (Recommended first, R1) and search; Advanced type chips ── */}
      <div className="space-y-2 px-4 pt-2.5 pb-2 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Product source">
            {SOURCES.map(({ key, label }) => {
              const isActive = source === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchSource(key)}
                  aria-pressed={isActive}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    isActive ? "bg-primary-lighter text-primary-dark" : "text-gray-light hover:text-gray"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {source === "browse" && (
            <button
              type="button"
              onClick={toggleSearch}
              aria-label={searchOpen ? "Close search" : "Search Browse shades"}
              aria-expanded={searchOpen}
              className={`ml-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                searchOpen ? "bg-primary-lighter text-primary-dark" : "text-gray hover:bg-gray-lightest"
              }`}
            >
              {searchOpen ? <X size={16} strokeWidth={2} /> : <Search size={16} strokeWidth={2} />}
            </button>
          )}
        </div>

        {source === "browse" && searchOpen && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, product, or shade"
            aria-label="Search Browse shades"
            autoFocus
            className="w-full rounded-xl border border-gray-lighter bg-white px-3.5 py-2 text-[13px] text-black placeholder:text-gray-light focus:border-primary-light focus:outline-none"
          />
        )}
        {/* Advanced only: product type inside the tab, with how many products each has, in one sideways row */}
        {!isBasic && !loading && typeOptions.length > 1 && (
          <div className={`-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:px-5 ${NO_SCROLLBAR}`} role="group" aria-label="Product type">
            {[["all", "All", groups.length], ...typeOptions.map((region) => [region, REGION_LABEL[region], typeCounts[region]])].map(
              ([key, label, count]) => {
                const isActive = effectiveType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveType(key)}
                    aria-pressed={isActive}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                      isActive ? "bg-primary-lighter text-primary-dark" : "bg-gray-lightest text-gray hover:text-black"
                    }`}
                  >
                    {label} <span className={isActive ? "text-primary/70" : "text-gray-light"}>{count}</span>
                  </button>
                );
              },
            )}
          </div>
        )}
      </div>

      </div>

      {/* ── Product List ── */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-lightest max-sm:flex-none max-sm:overflow-visible">
        {notesReady && (
          <div className="px-4 pt-3 pb-1 sm:px-5">
            {source === "browse" ? (
              <Notice icon={Info} iconClass="text-gray-light">
                Not ingredient-checked{ranked ? " · Best color match first" : ""}
              </Notice>
            ) : ranked ? (
              <Notice icon={ShieldCheck} iconClass="text-[#059669]">
                Ingredient-checked for you · Best color match first
              </Notice>
            ) : seasonFilter === "no_season" ? (
              <Notice icon={Palette} iconClass="text-primary">
                <Link to="/color-analysis" className="font-semibold text-primary underline">
                  Run Color Analysis
                </Link>{" "}
                to sort by what suits you
              </Notice>
            ) : (
              <Notice icon={ShieldCheck} iconClass="text-[#059669]">
                Ingredient-checked for you · Safest first
              </Notice>
            )}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-xs text-gray-light">Loading shades…</p>
        ) : source === "recommended" && status !== "ok" ? (
          <EmptyState
            message={EMPTY_MESSAGES[status] ?? EMPTY_MESSAGES.error}
            actionLabel="Browse instead"
            onAction={() => switchSource("browse")}
          />
        ) : source === "browse" && status !== "ok" ? (
          <EmptyState message="Could not load Browse shades." />
        ) : visibleGroups.length === 0 && debouncedQuery ? (
          <EmptyState message={`No products match "${debouncedQuery}".`} />
        ) : visibleGroups.length === 0 && isBasic ? (
          <EmptyState
            message={`No ${(REGION_LABEL[effectiveType] ?? "").toLowerCase()} products here yet.`}
            actionLabel="Show Advanced"
            onAction={() => switchMode("advanced")}
          />
        ) : visibleGroups.length === 0 ? (
          <EmptyState message="No products here yet." />
        ) : (
          <ProductList
            key={`${activeGroup}:${effectiveType}:${source}:${debouncedQuery}`}
            groups={visibleGroups}
            selectedShades={selectedShades}
            onSelect={onSelectShade}
            showType={effectiveType === "all"}
            asCards={source === "recommended"}
          />
        )}
      </div>
    </div>
  );
}
