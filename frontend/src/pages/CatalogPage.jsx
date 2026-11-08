import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, X } from "lucide-react";
import { getProductCatalog, runFilter } from "../services/productService";
import { useUserStore } from "../store/userStore";
import { ProductCard } from "../components/catalog/ProductCard.jsx";
import { CatalogViewToggle } from "../components/catalog/CatalogViewToggle.jsx";
import { CatalogFilters, CatalogSearch } from "../components/catalog/CatalogFilters.jsx";
import { ProductDetail } from "../components/catalog/ProductDetail.jsx";
import { OfflineNote } from "../components/common/OfflineBanner.jsx";

// The safety filter checks one category per request (api.py category_map), so the page asks once per category.
// These are the same requests the old ingredient filter page made, one at a time.
const FILTER_CATEGORIES = ["Face", "Concealer", "Cheeks", "Lips", "Eyes", "Multiuse"];
const PAGE_SIZE = 20;
const VIEWS = ["safe", "all"];
// Category filter value (URL) -> category as stored in the data (build_catalog.py, api.py category_map).
const CATEGORY_DATA = { cheek: "Cheek", concealer: "Concealer", eye: "Eye", face: "Face", lip: "Lip", multiuse: "Multi-Use" };
const ALL_VERDICTS = ["safe", "caution", "excluded"];

const byCategoryThenName = (a, b) =>
  String(a.category ?? "").localeCompare(String(b.category ?? "")) ||
  String(a.product_name ?? "").localeCompare(String(b.product_name ?? ""));

const verdictOf = (item) => String(item?.verdict ?? "").toLowerCase();

// "lip,cheek" -> ["lip", "cheek"], keeping only known values, in a stable order.
const parseList = (value, allowed) => allowed.filter((option) => String(value ?? "").split(",").includes(option));

/* Card grid: 2 columns on phones, 3 on tablets and small laptops, 4 on laptops, 5 on wide screens. */
function ProductGrid({ items, onSelect }) {
  return (
    // One column on very narrow phones (under 360px), where two cards would be about 138px wide.
    <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((item) => (
        <li key={item.product_id}>
          <ProductCard product={item} onSelect={(e) => onSelect(item, e.currentTarget)} />
        </li>
      ))}
    </ul>
  );
}

/* Numbered pages: first, last, and the pages next to the current one, with "..." for the gaps. */
function Pagination({ label, page, total, onChange }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const button = "flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold transition-colors";
  return (
    <nav aria-label={label} className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <p className="text-xs text-gray">
        Showing {first}-{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className={`${button} text-gray hover:bg-white disabled:opacity-30`}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        {numbers.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1 text-sm text-gray-light">...</span>}
            <button
              type="button"
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              onClick={() => onChange(n)}
              className={`${button} ${n === page ? "bg-primary text-white" : "text-gray hover:bg-white"}`}
            >
              {n}
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={page === pages}
          onClick={() => onChange(page + 1)}
          className={`${button} text-gray hover:bg-white disabled:opacity-30`}
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

/* Phones: the filter panel as a bottom sheet. Escape, the close button or the backdrop close it. */
function FilterSheet({ resultCount, onClose, children }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-500 flex items-end bg-black/40 lg:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-primary-lightest shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-primary-lighter px-5 py-4">
          <h2 id="filter-sheet-title" className="font-heading text-lg font-semibold">
            Filters
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-full p-2 text-gray hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        <div className="border-t border-primary-lighter p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Show {resultCount} products
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState({ label }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-20 text-sm text-gray">
      <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-primary" />
      {label}
    </div>
  );
}

function MessageState({ title, text, actionLabel, onAction, children }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-primary-lighter">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray">{text}</p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}

export function CatalogPage() {
  const user = useUserStore((state) => state.user);
  const hasProfile = Boolean(user?.profile_completed || user?.skin_type);
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("view");
  const view = VIEWS.includes(requested) ? requested : hasProfile ? "safe" : "all";
  // A new history entry per switch, keeping any other URL parameters except the page numbers.
  const setView = (next) =>
    setSearchParams((params) => {
      params.set("view", next);
      params.delete("page");
      params.delete("xpage");
      return params;
    });

  // Filters live in the URL too ("lip,cheek"). They replace the current entry, so typing or ticking boxes does not
  // fill history, and they send every list back to page 1. Excluded is a valid verdict only in Full catalog.
  // BrowserRouter applies URL changes as a transition, so a ticked box would briefly snap back until the URL
  // catches up. The ticked boxes are therefore kept in local state too, updated at once, and re-read from the URL
  // whenever the URL changes (back button, shared link, Clear filters).
  const urlCategories = searchParams.get("category") ?? "";
  const urlVerdicts = searchParams.get("verdict") ?? "";
  const [ticked, setTicked] = useState({ category: urlCategories, verdict: urlVerdicts });
  const [tickedFrom, setTickedFrom] = useState(`${urlCategories}|${urlVerdicts}`);
  if (tickedFrom !== `${urlCategories}|${urlVerdicts}`) {
    setTickedFrom(`${urlCategories}|${urlVerdicts}`);
    setTicked({ category: urlCategories, verdict: urlVerdicts });
  }
  const categories = parseList(ticked.category, Object.keys(CATEGORY_DATA));
  const verdicts = parseList(ticked.verdict, view === "all" ? ALL_VERDICTS : ["safe", "caution"]);
  const query = searchParams.get("q") ?? "";
  // Filtering the grid can lag one keystroke behind typing, so the input itself never waits for it.
  const deferredQuery = useDeferredValue(query);
  const filterCount = categories.length + verdicts.length;
  const filtersActive = Boolean(filterCount || query.trim());
  const setFilters = (patch) =>
    setSearchParams(
      (params) => {
        for (const [key, value] of Object.entries(patch)) {
          if (value) params.set(key, value);
          else params.delete(key);
        }
        params.delete("page");
        params.delete("xpage");
        return params;
      },
      { replace: true },
    );
  const toggleFilter = (key, value) => {
    const current = key === "category" ? categories : verdicts;
    const next = (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]).join(",");
    setTicked((t) => ({ ...t, [key]: next }));
    setFilters({ [key]: next });
  };
  const clearFilters = () => {
    setTicked({ category: "", verdict: "" });
    setFilters({ category: "", verdict: "", q: "" });
  };
  const [sheetOpen, setSheetOpen] = useState(false);

  // Page numbers: ?page= for the main list, ?xpage= for the Excluded section. A page change is a new history entry,
  // so the back button returns to the previous page, and the list scrolls back to its top.
  const resultsRef = useRef(null);
  const pageFrom = (key, total) => {
    const n = Number.parseInt(searchParams.get(key), 10);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), pages) : 1;
  };
  const goToPage = (key, n) => {
    setSearchParams((params) => {
      if (n > 1) params.set(key, String(n));
      else params.delete(key);
      return params;
    });
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const pageSlice = (items, page) => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Product detail: the open product is ?product=<id>. Opening pushes a history entry (marked in its state), so the
  // back button closes it; the close button steps back over that entry, or just drops the parameter on a shared link.
  const location = useLocation();
  const navigate = useNavigate();
  const productId = searchParams.get("product");
  const openerRef = useRef(null);
  const openDetail = (item, opener) => {
    openerRef.current = opener;
    setSearchParams(
      (params) => {
        params.set("product", item.product_id);
        return params;
      },
      { state: { catalogDetail: true } },
    );
  };
  const closeDetail = () => {
    if (location.state?.catalogDetail) navigate(-1);
    else
      setSearchParams(
        (params) => {
          params.delete("product");
          return params;
        },
        { replace: true },
      );
  };
  // Back on the card that opened the detail, however it was closed.
  useEffect(() => {
    if (!productId && openerRef.current?.isConnected) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [productId]);

  const [catalog, setCatalog] = useState(null); // null while loading
  const [filterResults, setFilterResults] = useState(null); // null while loading or not requested
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [filterAttempt, setFilterAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getProductCatalog().then((items) => active && setCatalog(items));
    return () => {
      active = false;
    };
  }, [catalogAttempt]);

  // Same payload as the old ingredient filter page, once per category. Loaded once; switching views reuses it.
  useEffect(() => {
    if (!user || !hasProfile) return;
    let active = true;
    const payload = {
      skin_type: user.skin_type || user.skin_profile?.base_type || "Normal",
      avoid_ingredients: user.avoid_ingredients || user.skin_profile?.blacklisted_ingredients || [],
      user_lab: user.user_lab,
      seasonal_label: user.seasonal_label,
    };
    Promise.all(FILTER_CATEGORIES.map((category) => runFilter({ ...payload, category }))).then((responses) => {
      if (active) setFilterResults(responses.flatMap((response) => response.color_matched || []));
    });
    return () => {
      active = false;
    };
  }, [user, hasProfile, filterAttempt]);

  // Safe for me: Safe first, then Caution, keeping the filter's own order inside each group. Never Excluded (C2).
  const safeItems = useMemo(() => {
    if (!filterResults) return [];
    const safe = filterResults.filter((item) => verdictOf(item) === "safe");
    const caution = filterResults.filter((item) => verdictOf(item) === "caution");
    return [...safe, ...caution];
  }, [filterResults]);

  // Full catalog: every product, with its verdict where the filter returned one (the filter result carries the
  // product's own fields too). Excluded products go to their own section below (decision 2, provisional).
  const { mainItems, excludedItems } = useMemo(() => {
    if (!catalog) return { mainItems: [], excludedItems: [] };
    const results = new Map((filterResults || []).map((item) => [item.product_id, item]));
    const merged = catalog.map((product) => results.get(product.product_id) ?? product);
    return {
      mainItems: merged.filter((item) => verdictOf(item) !== "excluded").sort(byCategoryThenName),
      excludedItems: merged.filter((item) => verdictOf(item) === "excluded").sort(byCategoryThenName),
    };
  }, [catalog, filterResults]);

  // The services return an empty list when a request fails, so "empty" is read as an error where real data is never
  // empty: the catalog itself, and all six filter responses together.
  const userLoading = !user;
  const filterLoading = hasProfile && filterResults === null;
  const filterFailed = hasProfile && filterResults !== null && filterResults.length === 0;
  const retryCatalog = () => {
    setCatalog(null);
    setCatalogAttempt((n) => n + 1);
  };
  const retryFilter = () => {
    setFilterResults(null);
    setFilterAttempt((n) => n + 1);
  };

  // The product the detail view shows: its filter result when there is one, else the catalog entry.
  const detailItem = useMemo(() => {
    if (!productId) return null;
    return (
      (filterResults || []).find((item) => item.product_id === productId) ??
      (catalog || []).find((item) => item.product_id === productId) ??
      null
    );
  }, [productId, filterResults, catalog]);

  // Filtering happens on data already loaded: no new requests. Within a group, any ticked option matches.
  const categoriesKey = categories.join(",");
  const verdictsKey = verdicts.join(",");
  const { filteredSafe, filteredMain, filteredExcluded } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const has = (text) => String(text ?? "").toLowerCase().includes(q);
    const wantedCategories = categoriesKey ? categoriesKey.split(",").map((c) => CATEGORY_DATA[c]) : [];
    const wantedVerdicts = verdictsKey ? verdictsKey.split(",") : [];
    const matches = (item) =>
      (!wantedCategories.length || wantedCategories.includes(item.category)) &&
      (!wantedVerdicts.length || wantedVerdicts.includes(verdictOf(item))) &&
      (!q || has(item.product_name) || has(item.brand));
    return {
      filteredSafe: safeItems.filter(matches),
      filteredMain: mainItems.filter(matches),
      filteredExcluded: excludedItems.filter(matches),
    };
  }, [safeItems, mainItems, excludedItems, categoriesKey, verdictsKey, deferredQuery]);

  // Count line for the current view, shown once its data is ready.
  const safeCount = safeItems.filter((item) => verdictOf(item) === "safe").length;
  const countText =
    view === "safe"
      ? !userLoading && !filterLoading && !filterFailed && safeItems.length > 0
        ? filtersActive
          ? `${filteredSafe.length} of ${safeItems.length} products for your skin`
          : `${safeItems.length} products for your skin: ${safeCount} Safe, ${safeItems.length - safeCount} Caution`
        : null
      : !userLoading && !filterLoading && catalog?.length
        ? filtersActive
          ? `${filteredMain.length + filteredExcluded.length} of ${catalog.length} products`
          : `${catalog.length} products`
        : null;
  const resultCount = view === "safe" ? filteredSafe.length : filteredMain.length + filteredExcluded.length;
  const noMatches = (
    <MessageState
      title="No products match these filters"
      text="Try another category or search."
      actionLabel="Clear filters"
      onAction={clearFilters}
    />
  );

  const renderSafeView = () => {
    if (!userLoading && !hasProfile) {
      return (
        <MessageState
          title="Set up your skin profile first"
          text="Safe for me checks every product against your skin type and the ingredients you avoid."
          actionLabel="Open full catalog"
          onAction={() => setView("all")}
        >
          <Link to="/onboarding" className="mt-3 block text-sm font-semibold text-primary underline">
            Set up my profile
          </Link>
        </MessageState>
      );
    }
    if (userLoading || filterLoading) return <LoadingState label="Checking products for your skin..." />;
    if (filterFailed) {
      return (
        <MessageState
          title="We couldn't run your safety check"
          text="Check your connection and try again."
          actionLabel="Try again"
          onAction={retryFilter}
        />
      );
    }
    if (safeItems.length === 0) {
      return (
        <MessageState
          title="No products passed your ingredient check"
          text="Every product we checked is Excluded for your profile. You can still browse them in the full catalog."
          actionLabel="Open full catalog"
          onAction={() => setView("all")}
        />
      );
    }
    if (filteredSafe.length === 0) return noMatches;
    const page = pageFrom("page", filteredSafe.length);
    return (
      <>
        <ProductGrid items={pageSlice(filteredSafe, page)} onSelect={openDetail} />
        <Pagination label="Product pages" page={page} total={filteredSafe.length} onChange={(n) => goToPage("page", n)} />
      </>
    );
  };

  const renderFullView = () => {
    if (userLoading || catalog === null || filterLoading) return <LoadingState label="Loading the catalog..." />;
    if (catalog.length === 0) {
      return (
        <MessageState
          title="We couldn't load the catalog"
          text="Check your connection and try again."
          actionLabel="Try again"
          onAction={retryCatalog}
        />
      );
    }
    const page = pageFrom("page", filteredMain.length);
    const xpage = pageFrom("xpage", filteredExcluded.length);
    return (
      <>
        {!hasProfile && (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm text-gray ring-1 ring-primary-lighter">
            Products show &quot;Not checked&quot; until you set up your skin profile.{" "}
            <Link to="/onboarding" className="font-semibold text-primary underline">
              Set up my profile
            </Link>
          </p>
        )}
        {filterFailed && (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm text-gray ring-1 ring-primary-lighter">
            Your safety check is unavailable right now, so products show &quot;Not checked&quot;.{" "}
            <button type="button" onClick={retryFilter} className="font-semibold text-primary underline">
              Try again
            </button>
          </p>
        )}
        {filteredMain.length + filteredExcluded.length === 0 && noMatches}
        {filteredMain.length > 0 && (
          <div>
            <ProductGrid items={pageSlice(filteredMain, page)} onSelect={openDetail} />
            <Pagination label="Product pages" page={page} total={filteredMain.length} onChange={(n) => goToPage("page", n)} />
          </div>
        )}
        {filteredExcluded.length > 0 && (
          <section aria-labelledby="excluded-heading" className="space-y-3 border-t border-primary-lighter pt-6">
            <h2 id="excluded-heading" className="font-heading text-xl font-semibold">
              Excluded for your profile ({filteredExcluded.length})
            </h2>
            <ProductGrid items={pageSlice(filteredExcluded, xpage)} onSelect={openDetail} />
            <Pagination
              label="Excluded product pages"
              page={xpage}
              total={filteredExcluded.length}
              onChange={(n) => goToPage("xpage", n)}
            />
          </section>
        )}
      </>
    );
  };

  const filterPanel = (idPrefix) => (
    <CatalogFilters
      idPrefix={idPrefix}
      view={view}
      categories={categories}
      verdicts={verdicts}
      active={filtersActive}
      onToggle={toggleFilter}
      onClear={clearFilters}
    />
  );

  return (
    <main className="page-shell bg-primary-lightest font-body text-black">
      <div className="mx-auto max-w-400 space-y-4 sm:space-y-5">
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Catalog</h1>
        </header>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <CatalogViewToggle value={view} onChange={setView} />
          {/* 28rem cap: max-w-md is 768px here (variables.css redefines --container-md). */}
          <div className="flex items-center gap-2 sm:min-w-64 sm:flex-1 lg:max-w-112">
            <CatalogSearch value={query} onChange={(q) => setFilters({ q })} />
            {/* Phones: a round icon button (named "Filters" for screen readers). From sm: the full pill. */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-primary-lighter bg-white text-sm font-semibold text-black shadow-sm sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 lg:hidden"
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Filters</span>
              {filterCount > 0 && (
                <span className="absolute -top-1 -right-1 rounded-full bg-primary px-1.5 text-xs text-white sm:static">{filterCount}</span>
              )}
            </button>
          </div>
          <p aria-live="polite" className="pt-1 text-sm text-gray sm:ml-auto sm:pt-0">
            {countText}
          </p>
        </div>

        {/* Offline both requests fail and the lists come back empty, which would read as "no products". */}
        <OfflineNote>The catalog needs internet. Connect and reload this page to see products.</OfflineNote>

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside aria-label="Filters" className="hidden lg:sticky lg:top-24 lg:block">
            {filterPanel("sidebar")}
          </aside>
          <div ref={resultsRef} className="min-w-0 scroll-mt-24 space-y-6">
            {view === "safe" ? renderSafeView() : renderFullView()}
          </div>
        </div>

        {sheetOpen && (
          <FilterSheet resultCount={resultCount} onClose={() => setSheetOpen(false)}>
            {filterPanel("sheet")}
          </FilterSheet>
        )}
        {detailItem && <ProductDetail product={detailItem} onClose={closeDetail} />}
      </div>
    </main>
  );
}
