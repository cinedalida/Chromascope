import { useEffect, useMemo, useRef, useState } from "react";
import { ShadeListSkeleton } from "../common/Skeletons.jsx";
import { Link } from "react-router-dom";
import { Bookmark, Info, Palette, Search, ShieldCheck, X } from "lucide-react";
import { useARShades } from "../../hooks/useARShades.js";
import { cleanProductName, groupByProduct, isEverydayProduct, searchProducts, shortShadeName } from "../../utils/shadeGroups.js";
import { ShadeFavoriteButton } from "./ProductSwatchPicker.jsx";
import { AR_GROUPS, REGION_LABEL, groupByKey, groupOfRegion } from "../../utils/arGroups.js";
import { selectedShadesToItems, useFavorites } from "../../hooks/useFavorites.js";
import { SaveLookDialog } from "../favorites/SaveLookDialog.jsx";
import { seasonChipsForCodes } from "../../utils/seasonLabels.js";
import { seasonCodeFor, seasonsForUser } from "../../utils/arFit.js";
import { useUserStore } from "../../store/userStore";
import { ProductPreview } from "./ProductPreview.jsx";
import { ShadeDot } from "../common/ShadeDot.jsx";

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

// One short note at the top of the list, same look on Recommended and Browse.
function Notice({ icon: Icon, iconClass, children }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-gray-lightest/70 px-3 py-2 text-[11px] leading-snug text-gray">
      <Icon aria-hidden="true" size={14} strokeWidth={2.25} className={`shrink-0 ${iconClass}`} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function EmptyState({ message, actionLabel, onAction, secondLabel, onSecond }) {
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
      {onSecond && (
        <button
          type="button"
          onClick={onSecond}
          className="mt-3 ml-4 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-light transition hover:opacity-70"
        >
          {secondLabel}
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

// Is this exact shade of the product the one on the face? A product's shades share its id, so the shade id counts too.
function isShadeSelected(group, shade, selectedShades) {
  const selected = selectedShades?.[group.region];
  return Boolean(selected) && selected.source === group.source && selected.id === shade.id && (selected.shadeId ?? null) === (shade.shadeId ?? null);
}

// A short note for a shade's dot: its name, then its percentage (skin products) or every season it belongs to.
function shadeHint(group, shade, userSeason) {
  const name = shade.shade || shade.product;
  if (group.matchBasis === "skin" && Number.isFinite(shade.fit)) return `${name} · ${Math.round(shade.fit * 100)}% match`;
  const seasons = seasonChipsForCodes(seasonsForUser(shade.shadeSeasons, shade.fit, userSeason)).join(", ");
  return seasons ? `${name} · ${seasons}` : name;
}

/* ── One product, the same card on Recommended and Browse: one row, the colors are the focus. The product name (a button) opens the product modal, which
      holds everything else (brand, seasons, price, safety details). Under it a large swatch for EVERY shade of the product
      that fits you (no "see more"): tapping one applies it, tapping the applied one removes it. Then the name of the shade
      shown (its percentage on skin products) and its heart. Buttons cannot nest, so each of these is its own button. ── */
function ShadeCard({ group, selectedShades, onSelect, onPreview, showKind }) {
  const appliedShade = group.shades.find((s) => isShadeSelected(group, s, selectedShades));
  const shade = appliedShade ?? group.shades[0];
  const isSelected = Boolean(appliedShade);
  const userSeason = seasonCodeFor(useUserStore((state) => state.user?.seasonal_label));
  const fullName = shade.shade || shade.product;
  const percent = group.matchBasis === "skin" && Number.isFinite(shade.fit) ? Math.round(shade.fit * 100) : null;
  return (
    <div
      className={`min-w-0 rounded-2xl p-3 ring-1 transition-colors duration-200 ${
        isSelected ? "bg-primary-lightest ring-primary" : "bg-white ring-gray-lightest"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onPreview(group)}
          aria-label={`See ${group.brand} ${group.product}`}
          title="See the product"
          className="group/name min-w-0 flex-1 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {/* Advanced only: what it is (Lipstick, Lip liner, ...). Basic lists one everyday type per tab, so it needs none. */}
          {showKind && group.kind && (
            <span className="mb-0.5 block text-[9px] leading-none font-bold uppercase tracking-wider text-gray-light">{group.kind}</span>
          )}
          <span className="line-clamp-2 font-heading text-sm leading-snug font-semibold text-black underline-offset-2 group-hover/name:underline">
            {cleanProductName(group.product)}
          </span>
        </button>
        {group.verdict && <VerdictBadge verdict={group.verdict} />}
      </div>

      {/* The colors: every shade that fits you. */}
      <div className="mt-2 flex flex-wrap" role="group" aria-label={`Shades of ${group.product} that fit you`}>
        {group.shades.map((dotShade) => {
          const isCurrent = dotShade === shade;
          const hint = shadeHint(group, dotShade, userSeason);
          return (
            <button
              key={dotShade.shadeId ?? dotShade.hex}
              type="button"
              onClick={() => onSelect(group.region, isShadeSelected(group, dotShade, selectedShades) ? null : dotShade)}
              aria-pressed={isCurrent && isSelected}
              aria-label={hint}
              title={hint}
              className="group/dot flex h-9 w-9 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ShadeDot
                aria-hidden="true"
                hex={dotShade.hex}
                className={`h-8 w-8 rounded-full transition-transform group-hover/dot:scale-110 ${
                  isCurrent ? "ring-2 ring-primary ring-offset-1" : "ring-1 ring-black/10"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* The shade shown, and its heart. */}
      <div className="mt-1.5 flex items-center gap-2">
        <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug text-gray">
          <span className="font-semibold text-black">{shortShadeName(fullName)}</span>
          {percent !== null && <span> · {percent}% match</span>}
        </p>
        <ShadeFavoriteButton shade={shade} />
      </div>
    </div>
  );
}

/* ── Paged list: rows on Browse, a two-column card grid on Recommended. Remounted (keyed) when tab, type, source or
      query changes, which resets the page count. The next page loads when "Show more" scrolls into view, or on tap. ── */
function ProductList({ groups, selectedShades, onSelect, onPreview, showKind }) {
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
      <div className="grid grid-cols-1 gap-2.5 px-4 py-3 sm:px-5">
        {groups.slice(0, visible).map((group) => (
          <ShadeCard
            key={group.key}
            group={group}
            selectedShades={selectedShades}
            onSelect={onSelect}
            onPreview={onPreview}
            showKind={showKind}
          />
        ))}
      </div>
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
  // Product type inside the tab ("all" or a region key such as "lipLiner"), picked with the chips under the tabs.
  // Arriving with an Advanced-only product (e.g. eyeliner) opens Advanced so that product is listed.
  const [mode, setMode] = useState(() =>
    initialRegion && !BASIC_REGIONS.has(initialRegion) ? "advanced" : readStoredMode(),
  );
  // Product type inside the tab in Advanced ("all" or a region key such as "eyeliner").
  const [activeType, setActiveType] = useState(() => initialRegion ?? "all");
  const [source, setSource] = useState("recommended");
  const [previewKey, setPreviewKey] = useState(null); // the product whose preview is open (its group key)
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { items, status, loading, seasonFilter, ranked, retry } = useARShades(activeGroup, source);
  const groups = useMemo(() => groupByProduct(items), [items]);
  const previewGroup = previewKey ? groups.find((group) => group.key === previewKey) : null;
  const userSeason = seasonCodeFor(useUserStore((state) => state.user?.seasonal_label));
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
    const shown = isBasic ? ofType.filter(isEverydayProduct) : ofType; // Basic: everyday makeup only (lipstick, not gloss or balm)
    return source === "browse" ? searchProducts(shown, debouncedQuery) : shown;
  }, [groups, effectiveType, source, debouncedQuery, isBasic]);

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
  const switchMode = (next) => {
    setMode(next);
    storeMode(next);
  };
  const toggleSearch = () => {
    if (searchOpen) clearSearch();
    setSearchOpen(!searchOpen);
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
                    <ShadeDot hex={shade.hex} className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" />
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
          <div className="relative">
            <Search
              aria-hidden="true"
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-light"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand, product, or shade"
              aria-label="Search Browse shades"
              autoFocus
              className="w-full rounded-xl border border-gray-lighter bg-white py-2 pr-3.5 pl-9 text-[13px] text-black placeholder:text-gray-light focus:border-primary-light focus:outline-none"
            />
          </div>
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
          <ShadeListSkeleton />
        ) : source === "recommended" && status !== "ok" ? (
          <EmptyState
            message={EMPTY_MESSAGES[status] ?? EMPTY_MESSAGES.error}
            actionLabel={status === "error" ? "Try again" : "Browse instead"}
            onAction={status === "error" ? retry : () => switchSource("browse")}
            secondLabel={status === "error" ? "Browse instead" : undefined}
            onSecond={status === "error" ? () => switchSource("browse") : undefined}
          />
        ) : source === "browse" && status !== "ok" ? (
          <EmptyState message="Could not load Browse shades." actionLabel="Try again" onAction={retry} />
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
            onPreview={(group) => setPreviewKey(group.key)}
            showKind={!isBasic}
          />
        )}
      </div>

      {previewGroup && (
        <ProductPreview
          group={previewGroup}
          selectedShades={selectedShades}
          userSeason={userSeason}
          isShadeSelected={isShadeSelected}
          onSelect={onSelectShade}
          onClose={() => setPreviewKey(null)}
        />
      )}
    </div>
  );
}


