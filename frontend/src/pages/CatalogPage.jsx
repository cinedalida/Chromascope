import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getProductCatalog, runFilter } from "../services/productService";
import { useUserStore } from "../store/userStore";
import { ProductCard } from "../components/catalog/ProductCard.jsx";
import { CatalogViewToggle } from "../components/catalog/CatalogViewToggle.jsx";
import { CatalogFilters } from "../components/catalog/CatalogFilters.jsx";
import { OfflineNote } from "../components/common/OfflineBanner.jsx";

// The safety filter checks one category per request (api.py category_map), so the page asks once per category.
// These are the same requests the old ingredient filter page made, one at a time.
const FILTER_CATEGORIES = ["Face", "Concealer", "Cheeks", "Lips", "Eyes", "Multiuse"];
const PAGE_SIZE = 24;
const VIEWS = ["safe", "all"];
// Category chip value (URL) -> category as stored in the data (build_catalog.py, api.py category_map).
const CATEGORY_DATA = { cheek: "Cheek", concealer: "Concealer", eye: "Eye", face: "Face", lip: "Lip", multiuse: "Multi-Use" };

const byCategoryThenName = (a, b) =>
  String(a.category ?? "").localeCompare(String(b.category ?? "")) ||
  String(a.product_name ?? "").localeCompare(String(b.product_name ?? ""));

const verdictOf = (item) => String(item?.verdict ?? "").toLowerCase();

/* Card grid: 2 columns on phones, 3 on tablets, then as many as fit (min 200px). Shows PAGE_SIZE more per tap. */
function ProductGrid({ items }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
        {items.slice(0, visible).map((item) => (
          <li key={item.product_id}>
            <ProductCard product={item} />
          </li>
        ))}
      </ul>
      {items.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((n) => n + PAGE_SIZE)}
          className="mx-auto mt-6 block rounded-full border border-primary-lighter bg-white px-6 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-lightest"
        >
          Show more ({items.length - visible} left)
        </button>
      )}
    </>
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
  // A new history entry per switch, keeping any other URL parameters.
  const setView = (next) =>
    setSearchParams((params) => {
      params.set("view", next);
      return params;
    });
  // Filters live in the URL too. They replace the current entry, so typing or tapping chips does not fill history.
  const category = CATEGORY_DATA[searchParams.get("category")] ? searchParams.get("category") : "";
  // Excluded is a valid verdict filter only in Full catalog; in Safe for me it is ignored.
  const requestedVerdict = searchParams.get("verdict");
  const verdict = ["safe", "caution"].includes(requestedVerdict) || (view === "all" && requestedVerdict === "excluded")
    ? requestedVerdict
    : "";
  const query = searchParams.get("q") ?? "";
  // Filtering the grid can lag one keystroke behind typing, so the input itself never waits for it.
  const deferredQuery = useDeferredValue(query);
  const filtersActive = Boolean(category || verdict || query.trim());
  const setFilters = (patch) =>
    setSearchParams(
      (params) => {
        for (const [key, value] of Object.entries(patch)) {
          if (value) params.set(key, value);
          else params.delete(key);
        }
        return params;
      },
      { replace: true },
    );

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

  // Filtering happens on data already loaded: no new requests.
  const { filteredSafe, filteredMain, filteredExcluded } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const has = (text) => String(text ?? "").toLowerCase().includes(q);
    const matches = (item) =>
      (!category || item.category === CATEGORY_DATA[category]) &&
      (!verdict || verdictOf(item) === verdict) &&
      (!q || has(item.product_name) || has(item.brand));
    return {
      filteredSafe: safeItems.filter(matches),
      filteredMain: mainItems.filter(matches),
      filteredExcluded: excludedItems.filter(matches),
    };
  }, [safeItems, mainItems, excludedItems, category, verdict, deferredQuery]);

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
  const clearFilters = () => setFilters({ category: "", verdict: "", q: "" });
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
    return <ProductGrid key={`safe-${category}-${verdict}-${deferredQuery}`} items={filteredSafe} />;
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
        {filteredMain.length > 0 && <ProductGrid key={`all-${category}-${verdict}-${deferredQuery}`} items={filteredMain} />}
        {filteredExcluded.length > 0 && (
          <section aria-labelledby="excluded-heading" className="space-y-3 border-t border-primary-lighter pt-6">
            <h2 id="excluded-heading" className="font-heading text-xl font-semibold">
              Excluded for your profile ({filteredExcluded.length})
            </h2>
            <ProductGrid key={`excluded-${category}-${verdict}-${deferredQuery}`} items={filteredExcluded} />
          </section>
        )}
      </>
    );
  };

  return (
    <main className="page-shell bg-primary-lightest font-body text-black">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Catalog</h1>
        </header>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CatalogViewToggle value={view} onChange={setView} />
          <p aria-live="polite" className="text-sm text-gray">
            {countText}
          </p>
        </div>

        <CatalogFilters
          view={view}
          category={category}
          verdict={verdict}
          query={query}
          active={filtersActive}
          onChange={setFilters}
          onClear={clearFilters}
        />

        {/* Offline both requests fail and the lists come back empty, which would read as "no products". */}
        <OfflineNote>The catalog needs internet. Connect and reload this page to see products.</OfflineNote>

        {view === "safe" ? renderSafeView() : renderFullView()}
      </div>
    </main>
  );
}
