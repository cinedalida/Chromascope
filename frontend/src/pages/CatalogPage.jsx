import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ProductGridSkeleton } from "../components/common/Skeletons.jsx";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { getCatalog, getSafetyResults } from "../services/catalogDataService";
import { useUserStore } from "../store/userStore";
import { ProductCard } from "../components/catalog/ProductCard.jsx";
import { CatalogViewToggle } from "../components/catalog/CatalogViewToggle.jsx";
import { SeasonContextBanner } from "../components/catalog/SeasonContextBanner.jsx";
import { CatalogFilters, CatalogSearch } from "../components/catalog/CatalogFilters.jsx";
import { CatalogSort } from "../components/catalog/CatalogSort.jsx";
import { parseSort, sortByPrice } from "../utils/catalogSort.js";
import { ProductDetail } from "../components/catalog/ProductDetail.jsx";
import { OfflineNote } from "../components/common/OfflineBanner.jsx";
import { subcategoryCounts, subcategoryLabels } from "../utils/catalogSubcategories.js";
import { fitsUser } from "../utils/arFit.js";

// The safety filter checks one category per request (api.py category_map), so the page asks once per category.
// These are the same requests the old ingredient filter page made, one at a time.
const PAGE_SIZE = 20;
const VIEWS = ["safe", "all"];
// Category filter value (URL) -> category as stored in the data (build_catalog.py, api.py category_map).
const CATEGORY_DATA = { cheek: "Cheek", concealer: "Concealer", eye: "Eye", face: "Face", lip: "Lip", multiuse: "Multi-Use" };
// Price filter value (URL) -> [min, max) in pesos. Same values as PRICE_OPTIONS in CatalogFilters.jsx.
const PRICE_RANGES = {
  "under-1000": [0, 1000],
  "1000-2000": [1000, 2000],
  "over-2000": [2000, Infinity],
};

const byCategoryThenName = (a, b) =>
  String(a.category ?? "").localeCompare(String(b.category ?? "")) ||
  String(a.product_name ?? "").localeCompare(String(b.product_name ?? ""));

const verdictOf = (item) => String(item?.verdict ?? "").toLowerCase();

// "800" -> 800; empty or anything that is not a whole number -> null.
const parseAmount = (value) => (/^\d+$/.test(String(value ?? "")) ? Number(value) : null);

// "lip,cheek" -> ["lip", "cheek"], keeping only known values, in a stable order.
const parseList = (value, allowed) => allowed.filter((option) => String(value ?? "").split(",").includes(option));

/* Card grid: 2 columns on phones, 3 on tablets and small laptops, 4 on laptops, 5 on wide screens. */
function ProductGrid({ items, onSelect, onlyMatching = false, plain = false }) {
  return (
    // One column on very narrow phones (under 360px), where two cards would be about 138px wide.
    <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((item) => (
        <li key={item.product_id}>
          <ProductCard product={item} onlyMatching={onlyMatching} plain={plain} onSelect={(e) => onSelect(item, e.currentTarget)} />
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
      return params;
    });

  // Filters live in the URL too ("lip,cheek"). They replace the current entry, so typing or ticking boxes does not
  // fill history, and they send every list back to page 1. Only "Compatible with me" has a safety verdict filter.
  // BrowserRouter applies URL changes as a transition, so a ticked box would briefly snap back until the URL
  // catches up. The ticked boxes are therefore kept in local state too, updated at once, and re-read from the URL
  // whenever the URL changes (back button, shared link, Clear filters).
  const urlCategories = searchParams.get("category") ?? "";
  const urlVerdicts = searchParams.get("verdict") ?? "";
  const urlSub = searchParams.get("sub") ?? "";
  const urlPrices = searchParams.get("price") ?? "";
  const urlPmin = searchParams.get("pmin") ?? "";
  const urlPmax = searchParams.get("pmax") ?? "";
  const urlSort = parseSort(searchParams.get("sort") ?? "");
  const urlKey = `${urlCategories}|${urlVerdicts}|${urlSub}|${urlPrices}|${urlPmin}|${urlPmax}|${urlSort}`;
  const fromUrl = () => ({ category: urlCategories, verdict: urlVerdicts, sub: urlSub, price: urlPrices, pmin: urlPmin, pmax: urlPmax, sort: urlSort });
  const [ticked, setTicked] = useState(fromUrl);
  const [tickedFrom, setTickedFrom] = useState(urlKey);
  if (tickedFrom !== urlKey) {
    setTickedFrom(urlKey);
    setTicked(fromUrl());
  }
  const categories = parseList(ticked.category, Object.keys(CATEGORY_DATA));
  const verdicts = view === "all" ? [] : parseList(ticked.verdict, ["safe", "caution"]);
  const prices = parseList(ticked.price, Object.keys(PRICE_RANGES));
  // Order of the products (not a filter: it is left out of filterCount and filtersActive).
  const sort = parseSort(ticked.sort);
  // Typed price amount (whole pesos, both ends included). Min above max is shown as a hint and not applied.
  const pmin = parseAmount(ticked.pmin);
  const pmax = parseAmount(ticked.pmax);
  const amountInvalid = pmin !== null && pmax !== null && pmin > pmax;
  const amountActive = !amountInvalid && (pmin !== null || pmax !== null);
  // The sub-category (Lipstick, Lip liner ...) only applies while exactly one category is chosen.
  const sub = categories.length === 1 ? ticked.sub : "";
  // Search text: the box shows local state, updated on every key, and the URL (?q=) follows 250ms after the last key.
  // Writing the URL on every key let a late URL update overwrite letters typed after it. The box only re-reads the
  // URL when it changes to something this page did not write (back button, shared link).
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [sentQuery, setSentQuery] = useState(urlQuery); // the last text written to the URL
  const [queryFrom, setQueryFrom] = useState(urlQuery);
  if (queryFrom !== urlQuery) {
    setQueryFrom(urlQuery);
    if (urlQuery !== sentQuery) {
      setSentQuery(urlQuery);
      setQuery(urlQuery);
    }
  }
  const queryTimer = useRef(null);
  useEffect(() => {
    const timer = queryTimer;
    return () => clearTimeout(timer.current);
  }, []);
  // Filtering the grid can lag one keystroke behind typing, so the input itself never waits for it.
  const deferredQuery = useDeferredValue(query);
  const filterCount = categories.length + verdicts.length + prices.length + (amountActive ? 1 : 0) + (sub ? 1 : 0);
  const filtersActive = Boolean(filterCount || query.trim() || ticked.pmin || ticked.pmax);
  const setFilters = (patch) =>
    setSearchParams(
      (params) => {
        for (const [key, value] of Object.entries(patch)) {
          if (value) params.set(key, value);
          else params.delete(key);
        }
        params.delete("page");
        return params;
      },
      { replace: true },
    );
  const toggleFilter = (key, value) => {
    const current = { category: categories, verdict: verdicts, price: prices }[key];
    const next = (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]).join(",");
    // Price ranges and a typed amount replace each other, so ticking a range clears the amount.
    const patch = key === "price" ? { price: next, pmin: "", pmax: "" } : { [key]: next };
    setTicked((t) => ({ ...t, ...patch }));
    setFilters(patch);
  };
  // Typing an amount keeps digits only (up to 6) and unticks the price ranges.
  const setAmount = (key, value) => {
    const patch = { [key]: String(value).replace(/\D/g, "").slice(0, 6), price: "" };
    setTicked((t) => ({ ...t, ...patch }));
    setFilters(patch);
  };
  // Category pills: one category at a time; it replaces any others and resets the sub-category.
  const selectCategory = (value) => {
    setTicked((t) => ({ ...t, category: value, sub: "" }));
    setFilters({ category: value, sub: "" });
  };
  const selectSub = (value) => {
    setTicked((t) => ({ ...t, sub: value }));
    setFilters({ sub: value });
  };
  const selectSort = (value) => {
    setTicked((t) => ({ ...t, sort: value }));
    setFilters({ sort: value });
  };
  const typeQuery = (text) => {
    setQuery(text);
    clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => {
      setSentQuery(text);
      setFilters({ q: text });
    }, 250);
  };
  const clearFilters = () => {
    clearTimeout(queryTimer.current);
    setQuery("");
    setSentQuery("");
    setTicked({ category: "", verdict: "", sub: "", price: "", pmin: "", pmax: "", sort: "" });
    setFilters({ category: "", verdict: "", sub: "", price: "", pmin: "", pmax: "", sort: "", q: "" });
  };
  const [sheetOpen, setSheetOpen] = useState(false);
  // Phones: once the Filters button at the top scrolls out of view, a floating copy appears at the bottom.
  const filterButtonRef = useRef(null);
  const [filterButtonOut, setFilterButtonOut] = useState(false);
  useEffect(() => {
    const button = filterButtonRef.current;
    if (!button || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setFilterButtonOut(!entry.isIntersecting));
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  // Page numbers: ?page=. A page change is a new history entry,
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
    getCatalog().then((items) => active && setCatalog(items));
    return () => {
      active = false;
    };
  }, [catalogAttempt]);

  // Same payload as the old ingredient filter page, once per category. Kept per profile (catalogDataService.js), so
  // switching views or coming back to this page reuses it, and only a profile change asks the server again.
  // Only "Compatible with me" needs it: the Full catalog is not checked against the profile, so it asks nothing.
  useEffect(() => {
    if (!user || !hasProfile || view !== "safe") return;
    let active = true;
    getSafetyResults(user).then(({ results }) => {
      if (active) setFilterResults(results);
    });
    return () => {
      active = false;
    };
  }, [user, hasProfile, view, filterAttempt]);

  // Compatible with me: Safe first, then Caution, keeping the filter's own order inside each group. Never Excluded (C2). Only
  // products that also suit the user's colors: a season-matched one (lips, blush, eyeshadow) whose best shade does not fit
  // their season is left out. Skin-matched ones (foundation, concealer, powder...) all stay, closest first, with their
  // percentage, as do products with nothing to match and users without a season / skin tone yet. The full catalog still
  // lists everything.
  const { safeItems, colorHiddenCount } = useMemo(() => {
    if (!filterResults) return { safeItems: [], colorHiddenCount: 0 };
    const passed = filterResults.filter((item) => ["safe", "caution"].includes(verdictOf(item)));
    const fitting = passed.filter((item) => fitsUser(item.fit_score, item.match_basis));
    const safe = fitting.filter((item) => verdictOf(item) === "safe");
    const caution = fitting.filter((item) => verdictOf(item) === "caution");
    return { safeItems: [...safe, ...caution], colorHiddenCount: passed.length - fitting.length };
  }, [filterResults]);

  // Full catalog: every product as stored, no safety or color check applied.
  const mainItems = useMemo(() => (catalog ? [...catalog].sort(byCategoryThenName) : []), [catalog]);

  // The services return an empty list when a request fails, so "empty" is read as an error where real data is never
  // empty: the catalog itself, and all six filter responses together.
  const userLoading = !user;
  const filterLoading = view === "safe" && hasProfile && filterResults === null;
  const filterFailed = view === "safe" && hasProfile && filterResults !== null && filterResults.length === 0;
  const retryCatalog = () => {
    setCatalog(null);
    setCatalogAttempt((n) => n + 1);
  };
  const retryFilter = () => {
    setFilterResults(null);
    setFilterAttempt((n) => n + 1);
  };

  // The product the detail view shows: in "Compatible with me" its filter result when there is one, else the catalog
  // entry; in the Full catalog always the catalog entry.
  const detailItem = useMemo(() => {
    if (!productId) return null;
    return (
      (view === "safe" ? (filterResults || []).find((item) => item.product_id === productId) : null) ??
      (catalog || []).find((item) => item.product_id === productId) ??
      null
    );
  }, [productId, view, filterResults, catalog]);

  // Filtering happens on data already loaded: no new requests. Within a group, any ticked option matches.
  const categoriesKey = categories.join(",");
  const verdictsKey = verdicts.join(",");
  const pricesKey = prices.join(",");
  const amountMin = amountActive ? pmin : null;
  const amountMax = amountActive ? pmax : null;
  const { filteredSafe, filteredMain } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const has = (text) => String(text ?? "").toLowerCase().includes(q);
    const wantedCategories = categoriesKey ? categoriesKey.split(",").map((c) => CATEGORY_DATA[c]) : [];
    const wantedVerdicts = verdictsKey ? verdictsKey.split(",") : [];
    const wantedPrices = pricesKey ? pricesKey.split(",").map((p) => PRICE_RANGES[p]) : [];
    // A product without a numeric price cannot be placed in a range, so it is left out while a price is ticked.
    const isPrice = (price) => typeof price === "number" && Number.isFinite(price);
    const inPrice = (price) => isPrice(price) && wantedPrices.some(([min, max]) => price >= min && price < max);
    const hasAmount = amountMin !== null || amountMax !== null;
    const inAmount = (price) =>
      isPrice(price) && (amountMin === null || price >= amountMin) && (amountMax === null || price <= amountMax);
    const matches = (item) =>
      (!wantedCategories.length || wantedCategories.includes(item.category)) &&
      (!sub || subcategoryLabels(item).includes(sub)) &&
      (!wantedVerdicts.length || wantedVerdicts.includes(verdictOf(item))) &&
      (!wantedPrices.length || inPrice(item.price)) &&
      (!hasAmount || inAmount(item.price)) &&
      (!q || has(item.product_name) || has(item.brand));
    // "Recommended" keeps each view's own order. A price sort keeps Safe products ahead of Caution ones in the
    // "Compatible with me" view, and sorts by price inside each group.
    return {
      filteredSafe: sortByPrice(safeItems.filter(matches), sort, (item) => (verdictOf(item) === "safe" ? 0 : 1)),
      filteredMain: sortByPrice(mainItems.filter(matches), sort),
    };
  }, [safeItems, mainItems, categoriesKey, verdictsKey, pricesKey, amountMin, amountMax, sub, deferredQuery, sort]);

  // Sub-categories of the chosen category, with how many products each has in the current view.
  const subOptions = useMemo(() => {
    if (categoriesKey.includes(",") || !categoriesKey) return [];
    const wanted = CATEGORY_DATA[categoriesKey];
    const pool = view === "safe" ? safeItems : mainItems;
    return subcategoryCounts(pool.filter((item) => item.category === wanted)).map(([label, count]) => ({
      value: label,
      label,
      count,
    }));
  }, [categoriesKey, view, safeItems, mainItems]);

  // Count line for the current view, shown once its data is ready.
  const hasSeason = Boolean(String(user?.seasonal_label ?? "").trim());
  const safeCount = safeItems.filter((item) => verdictOf(item) === "safe").length;
  const countText =
    view === "safe"
      ? !userLoading && !filterLoading && !filterFailed && safeItems.length > 0
        ? filtersActive
          ? `${filteredSafe.length} of ${safeItems.length} products for you`
          : `${safeItems.length} products for your skin${hasSeason ? " and colors" : ""}: ${safeCount} Safe, ${safeItems.length - safeCount} Caution`
        : null
      : !userLoading && catalog?.length
        ? filtersActive
          ? `${filteredMain.length} of ${catalog.length} products`
          : `${catalog.length} products`
        : null;
  const resultCount = view === "safe" ? filteredSafe.length : filteredMain.length;
  const noMatches = (
    <MessageState
      title="No products match these filters"
      text="Try another category, price or search."
      actionLabel="Clear filters"
      onAction={clearFilters}
    />
  );

  const renderSafeView = () => {
    if (!userLoading && !hasProfile) {
      return (
        <MessageState
          title="Set up your skin profile first"
          text="Compatible with me checks every product against your skin type, the ingredients you avoid and your colors."
          actionLabel="Open full catalog"
          onAction={() => setView("all")}
        >
          <Link to="/onboarding" className="mt-3 block text-sm font-semibold text-primary underline">
            Set up my profile
          </Link>
        </MessageState>
      );
    }
    if (userLoading || filterLoading) return <ProductGridSkeleton label="Checking products for your skin..." />;
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
          title={colorHiddenCount > 0 ? "No safe product matches your colors yet" : "No products passed your ingredient check"}
          text={
            colorHiddenCount > 0
              ? "The products that passed your ingredient check have no shade that fits your colors. You can still browse every product in the full catalog."
              : "Every product we checked is Excluded for your profile. You can still browse them in the full catalog."
          }
          actionLabel="Open full catalog"
          onAction={() => setView("all")}
        />
      );
    }
    if (filteredSafe.length === 0) return noMatches;
    const page = pageFrom("page", filteredSafe.length);
    return (
      <>
        <ProductGrid items={pageSlice(filteredSafe, page)} onSelect={openDetail} onlyMatching />
        <Pagination label="Product pages" page={page} total={filteredSafe.length} onChange={(n) => goToPage("page", n)} />
      </>
    );
  };

  const renderFullView = () => {
    if (userLoading || catalog === null) return <ProductGridSkeleton label="Loading the catalog..." />;
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
    if (filteredMain.length === 0) return noMatches;
    return (
      <div>
        <ProductGrid items={pageSlice(filteredMain, page)} onSelect={openDetail} plain />
        <Pagination label="Product pages" page={page} total={filteredMain.length} onChange={(n) => goToPage("page", n)} />
      </div>
    );
  };

  const filterPanel = (idPrefix) => (
    <CatalogFilters
      idPrefix={idPrefix}
      view={view}
      categories={categories}
      subOptions={subOptions}
      sub={sub}
      verdicts={verdicts}
      prices={prices}
      amount={{ pmin: ticked.pmin, pmax: ticked.pmax }}
      amountInvalid={amountInvalid}
      active={filtersActive}
      onSelectCategory={selectCategory}
      onSelectSub={selectSub}
      onToggle={toggleFilter}
      onAmount={setAmount}
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
            <CatalogSearch value={query} onChange={typeQuery} />
            {/* Phones: a round icon button (named "Filters" for screen readers). From sm: the full pill. */}
            <button
              ref={filterButtonRef}
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
          <CatalogSort value={sort} onChange={selectSort} />
          <p aria-live="polite" className="pt-1 text-sm text-gray sm:ml-auto sm:pt-0">
            {countText}
          </p>
        </div>

        {/* Offline both requests fail and the lists come back empty, which would read as "no products". */}
        <OfflineNote>The catalog needs internet. Connect and reload this page to see products.</OfflineNote>

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Stays in view while the products scroll. Capped at the window height, so a long panel scrolls inside
              itself (scrollbar hidden) instead of running off the bottom. The small padding keeps the cards' rings
              from being clipped. */}
          <aside
            aria-label="Filters"
            className="hidden lg:sticky lg:top-24 lg:-m-1 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filterPanel("sidebar")}
          </aside>
          <div ref={resultsRef} className="min-w-0 scroll-mt-24 space-y-6">
            {view === "safe" && hasProfile && !userLoading && (
              <SeasonContextBanner season={user?.seasonal_label} hasSkinTone={Array.isArray(user?.user_lab) && user.user_lab.length === 3} />
            )}
            {view === "safe" ? renderSafeView() : renderFullView()}
          </div>
        </div>

        {filterButtonOut && !sheetOpen && !detailItem && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2 lg:hidden"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            Filters
            {filterCount > 0 && <span className="rounded-full bg-white px-1.5 text-xs text-primary">{filterCount}</span>}
          </button>
        )}
        {sheetOpen && (
          <FilterSheet resultCount={resultCount} onClose={() => setSheetOpen(false)}>
            {filterPanel("sheet")}
          </FilterSheet>
        )}
        {detailItem && <ProductDetail product={detailItem} onClose={closeDetail} plain={view === "all"} />}
      </div>
    </main>
  );
}
