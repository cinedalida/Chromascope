import { useEffect, useMemo, useRef, useState } from "react";
import { FavoriteCardSkeleton, ProductGridSkeleton } from "../components/common/Skeletons.jsx";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { getCatalog, getSafetyResults } from "../services/catalogDataService";
import { getShades } from "../services/arShadeService";
import { useUserStore } from "../store/userStore";
import { canTryOn, favoriteToTryOn, isTryOnRegion, useFavorites } from "../hooks/useFavorites";
import { FavoriteProductCard } from "../components/favorites/FavoriteProductCard.jsx";
import { ProductDetail } from "../components/catalog/ProductDetail.jsx";
import { LookCard } from "../components/favorites/LookCard.jsx";
import { SearchInput } from "../components/common/SearchInput.jsx";

// Same safety filter results as the catalog page, so every badge is the current verdict, never a saved one (F-R1).
const TABS = [
  { key: "products", label: "Products" },
  { key: "looks", label: "Looks" },
];
// One column on very narrow phones (under 360px), where two cards would be about 130px wide.
const GRID = "grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5";

function EmptyState({ title, text }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-primary-lighter">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray">{text}</p>
      <div className="mt-5 flex justify-center gap-2">
        <Link to="/catalog" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
          Browse the catalog
        </Link>
        <Link to="/ar-tryon" className="rounded-full border border-primary-lighter bg-white px-5 py-2.5 text-sm font-semibold text-primary">
          Open Try-On
        </Link>
      </div>
    </div>
  );
}

function TryOnButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-lightest py-2 text-xs font-semibold text-primary-dark transition hover:bg-primary-lighter focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.25} />
      Try on
    </button>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-full border border-primary-lighter bg-white py-1.5 text-xs font-semibold text-gray hover:text-black"
    >
      Remove
    </button>
  );
}

export function FavoritesPage() {
  const user = useUserStore((state) => state.user);
  const hasProfile = Boolean(user?.profile_completed || user?.skin_type);
  const { status, favorites, error, removeFavorite, renameLook, clearError } = useFavorites();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "looks" ? "looks" : "products";

  const [catalog, setCatalog] = useState(null);
  const [filterResults, setFilterResults] = useState(null);
  const [browse, setBrowse] = useState({}); // region -> Browse shade items

  // Both are kept across visits (catalogDataService.js): coming back makes no requests, a profile change refreshes the verdicts.
  useEffect(() => {
    let active = true;
    getCatalog().then((items) => active && setCatalog(items));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !hasProfile) return undefined;
    let active = true;
    getSafetyResults(user).then(({ results }) => {
      if (active) setFilterResults(results);
    });
    return () => {
      active = false;
    };
  }, [user, hasProfile]);

  // Browse shades (the static AR catalog) for the regions that Browse favorites use, loaded once per region.
  const browseRegions = useMemo(
    () => [...new Set(favorites.flatMap((f) => f.items).filter((i) => i.source === "browse").map((i) => i.region))].sort().join(","),
    [favorites],
  );
  useEffect(() => {
    let active = true;
    for (const region of browseRegions ? browseRegions.split(",") : []) {
      getShades(region)
        .then((items) => active && setBrowse((b) => (b[region] ? b : { ...b, [region]: items })))
        .catch(() => active && setBrowse((b) => (b[region] ? b : { ...b, [region]: [] })));
    }
    return () => {
      active = false;
    };
  }, [browseRegions]);

  const byId = useMemo(() => {
    const map = new Map((catalog || []).map((p) => [p.product_id, p]));
    for (const result of filterResults || []) map.set(result.product_id, result);
    return map;
  }, [catalog, filterResults]);

  // { status: "ok" | "missing" | "loading", product, browse } for one favorite item (F-R6: gone products are "missing").
  const resolve = (item) => {
    if (item.source === "browse") {
      const shades = browse[item.region];
      if (!shades) return { status: "loading" };
      const shade = shades.find((s) => s.id === item.shade_id);
      if (!shade) return { status: "missing" };
      return {
        status: "ok",
        browse: true,
        product: {
          product_id: null, product_name: shade.product, brand: shade.brand, hex_color: shade.hex, price: shade.price,
          price_currency: shade.currency, image_url: "", verdict: null, shade_name: shade.shade,
        },
      };
    }
    if (catalog === null || (hasProfile && filterResults === null)) return { status: "loading" };
    const product = byId.get(item.product_id);
    return product ? { status: "ok", product } : { status: "missing" };
  };

  // "Try on": the favorite's shades go to AR in navigation state (like the catalog's own Try on), applied before the
  // first frame. Items that are gone or cannot be tried on are listed there instead of failing silently.
  const navigate = useNavigate();
  const [pendingTryOn, setPendingTryOn] = useState(null); // Excluded favorite waiting for the F-R4 notice
  const tryOn = async (favorite, confirmed = false) => {
    const result = await favoriteToTryOn(favorite, user, { byId, browse });
    if (result.excluded.length > 0 && !confirmed) {
      setPendingTryOn({ favorite, names: result.excluded });
      return;
    }
    navigate("/ar-tryon", {
      state: {
        favoriteTryOn: {
          shades: result.shades,
          missing: result.missing,
          notAvailable: result.notAvailable,
          look: favorite.type === "look" ? { id: favorite.id, name: favorite.name, items: favorite.items } : null,
        },
      },
    });
  };
  const tryOnAllowed = (item, product, isBrowse) =>
    isBrowse ? isTryOnRegion(item.region) : canTryOn(product);

  const products = favorites.filter((f) => f.type === "product");
  const looks = favorites.filter((f) => f.type === "look");
  const setTab = (next) =>
    setSearchParams((params) => {
      params.set("tab", next);
      return params;
    });

  // Search (?q=), shared by both tabs. Like the catalog, typing replaces the history entry instead of adding one.
  // Items still loading or no longer available have nothing to match, so they are hidden while searching.
  const query = searchParams.get("q") ?? "";
  const q = query.trim().toLowerCase();
  const setQuery = (next) =>
    setSearchParams(
      (params) => {
        if (next) params.set("q", next);
        else params.delete("q");
        return params;
      },
      { replace: true },
    );
  const has = (text) => String(text ?? "").toLowerCase().includes(q);
  const itemMatches = (item) => {
    const { status: itemStatus, product } = resolve(item);
    return itemStatus === "ok" && (has(product.product_name) || has(product.brand) || has(product.shade_name));
  };
  const shownProducts = q ? products.filter((favorite) => itemMatches(favorite.items[0])) : products;
  const shownLooks = q ? looks.filter((look) => has(look.name) || look.items.some(itemMatches)) : looks;
  const noMatches = (
    <div className="mx-auto max-w-md rounded-3xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-primary-lighter">
      <h2 className="font-heading text-lg font-semibold">No favorites match your search</h2>
      <p className="mt-2 text-sm text-gray">Try another name, brand or shade.</p>
      <button
        type="button"
        onClick={() => setQuery("")}
        className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
      >
        Clear search
      </button>
    </div>
  );
  const tabHasFavorites = (tab === "products" ? products : looks).length > 0;

  // Detail view for a catalog favorite; focus goes back to its card on close.
  const [detail, setDetail] = useState(null);
  const openerRef = useRef(null);
  const closeDetail = () => {
    setDetail(null);
    openerRef.current?.focus();
  };

  const renderProducts = () => {
    if (products.length === 0) {
      return <EmptyState title="No favorite products yet" text="Tap the heart on a product in the catalog to keep it here." />;
    }
    if (shownProducts.length === 0) return noMatches;
    return (
      <ul className={GRID}>
        {shownProducts.map((favorite) => {
          const { status: itemStatus, product, browse: isBrowse } = resolve(favorite.items[0]);
          return (
            <li key={favorite.id}>
              {itemStatus === "ok" ? (
                <FavoriteProductCard
                  product={product}
                  isBrowse={isBrowse}
                  onRemove={() => removeFavorite(favorite.id)}
                  onSelect={
                    isBrowse
                      ? undefined
                      : (e) => {
                          openerRef.current = e.currentTarget;
                          setDetail(product);
                        }
                  }
                >
                  {tryOnAllowed(favorite.items[0], product, isBrowse) ? (
                    <TryOnButton onClick={() => tryOn(favorite)} />
                  ) : (
                    <p className="py-2 text-center text-[11px] text-gray">Not available in try-on</p>
                  )}
                </FavoriteProductCard>
              ) : itemStatus === "loading" ? (
                <FavoriteCardSkeleton />
              ) : (
                <div className="flex h-full min-h-40 flex-col justify-between rounded-2xl border border-dashed border-primary-lighter bg-white p-4">
                  <p className="text-sm text-gray">No longer available</p>
                  <RemoveButton onClick={() => removeFavorite(favorite.id)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const renderLooks = () => {
    if (looks.length === 0) {
      return <EmptyState title="No saved looks yet" text="Put shades on in Try-On, then tap Save look to keep the combination here." />;
    }
    if (shownLooks.length === 0) return noMatches;
    return (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shownLooks.map((look) => (
          <li key={look.id}>
            <LookCard
              look={look}
              resolve={resolve}
              onRename={renameLook}
              onDelete={removeFavorite}
              onOpenProduct={(product, opener) => {
                openerRef.current = opener;
                setDetail(product);
              }}
            >
              <TryOnButton onClick={() => tryOn(look)} />
            </LookCard>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <main className="page-shell bg-primary-lightest font-body text-black">
      <div className="mx-auto max-w-400 space-y-5">
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Favorites</h1>
        </header>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div role="group" aria-label="Favorites type" className="inline-flex self-start sm:self-auto rounded-full bg-white p-1 shadow-sm ring-1 ring-primary-lighter">
            {TABS.map(({ key, label }) => {
              const active = tab === key;
              const count = key === "products" ? products.length : looks.length;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => !active && setTab(key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:px-5 ${
                    active ? "bg-primary text-white shadow-sm" : "text-gray hover:text-primary"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
          {status === "ready" && tabHasFavorites && (
            <div className="sm:min-w-64 sm:flex-1 lg:max-w-112">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder={tab === "products" ? "Search name, brand or shade" : "Search look, product or brand"}
                ariaLabel={tab === "products" ? "Search favorite products" : "Search saved looks"}
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-black ring-1 ring-primary-lighter">
            {error}
            <button type="button" onClick={clearError} aria-label="Dismiss" className="rounded-full p-1 text-gray hover:bg-gray-lightest">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </p>
        )}

        {pendingTryOn && (
          <div role="alertdialog" aria-label="Excluded product" className="rounded-2xl bg-[var(--color-danger-light)] px-4 py-3 text-sm text-black">
            <p>
              {pendingTryOn.names.join(", ")} {pendingTryOn.names.length === 1 ? "is" : "are"} Excluded for your profile.
              Try it on anyway?
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const { favorite } = pendingTryOn;
                  setPendingTryOn(null);
                  tryOn(favorite, true);
                }}
                className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white"
              >
                Try on anyway
              </button>
              <button type="button" onClick={() => setPendingTryOn(null)} className="rounded-full px-4 py-1.5 text-xs font-semibold text-gray">
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === "loading" || status === "idle" ? (
          <ProductGridSkeleton count={6} label="Loading your favorites..." />
        ) : status === "error" ? (
          <EmptyState title="We couldn't load your favorites" text="Check your connection and reload the page." />
        ) : tab === "products" ? (
          renderProducts()
        ) : (
          renderLooks()
        )}

        {detail && <ProductDetail product={detail} onClose={closeDetail} />}
      </div>
    </main>
  );
}
