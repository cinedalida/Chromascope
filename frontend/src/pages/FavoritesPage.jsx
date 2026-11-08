import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Info, Loader2, X } from "lucide-react";
import { getProductCatalog, runFilter } from "../services/productService";
import { getShades } from "../services/arShadeService";
import { useUserStore } from "../store/userStore";
import { useFavorites } from "../hooks/useFavorites";
import { ProductCard } from "../components/catalog/ProductCard.jsx";
import { ProductDetail } from "../components/catalog/ProductDetail.jsx";
import { LookCard } from "../components/favorites/LookCard.jsx";

// Same safety filter requests as the catalog page, so every badge is the current verdict, never a saved one (F-R1).
const FILTER_CATEGORIES = ["Face", "Concealer", "Cheeks", "Lips", "Eyes", "Multiuse"];
const TABS = [
  { key: "products", label: "Products" },
  { key: "looks", label: "Looks" },
];
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5";

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

function RemoveButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 w-full rounded-full border border-primary-lighter bg-white py-1.5 text-xs font-semibold text-gray hover:text-black"
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

  useEffect(() => {
    let active = true;
    getProductCatalog().then((items) => active && setCatalog(items));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !hasProfile) return undefined;
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
          price_currency: shade.currency, image_url: "", verdict: null,
        },
      };
    }
    if (catalog === null || (hasProfile && filterResults === null)) return { status: "loading" };
    const product = byId.get(item.product_id);
    return product ? { status: "ok", product } : { status: "missing" };
  };

  const products = favorites.filter((f) => f.type === "product");
  const looks = favorites.filter((f) => f.type === "look");
  const setTab = (next) =>
    setSearchParams((params) => {
      params.set("tab", next);
      return params;
    });

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
    return (
      <ul className={GRID}>
        {products.map((favorite) => {
          const { status: itemStatus, product, browse: isBrowse } = resolve(favorite.items[0]);
          return (
            <li key={favorite.id}>
              {itemStatus === "ok" ? (
                <>
                  <ProductCard
                    product={product}
                    onSelect={
                      isBrowse
                        ? undefined
                        : (e) => {
                            openerRef.current = e.currentTarget;
                            setDetail(product);
                          }
                    }
                  />
                  {isBrowse && (
                    <>
                      <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-gray">
                        <Info aria-hidden="true" className="h-3 w-3 shrink-0" />
                        Not checked by the safety filter.
                      </p>
                      <RemoveButton onClick={() => removeFavorite(favorite.id)} />
                    </>
                  )}
                </>
              ) : (
                <div className="flex h-full min-h-40 flex-col justify-between rounded-2xl border border-dashed border-primary-lighter bg-white p-4">
                  <p className="text-sm text-gray">{itemStatus === "loading" ? "Loading..." : "No longer available"}</p>
                  {itemStatus === "missing" && <RemoveButton onClick={() => removeFavorite(favorite.id)} />}
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
    return (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {looks.map((look) => (
          <li key={look.id}>
            <LookCard look={look} resolve={resolve} onRename={renameLook} onDelete={removeFavorite} />
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

        <div role="group" aria-label="Favorites type" className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-primary-lighter">
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

        {error && (
          <p role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-black ring-1 ring-primary-lighter">
            {error}
            <button type="button" onClick={clearError} aria-label="Dismiss" className="rounded-full p-1 text-gray hover:bg-gray-lightest">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </p>
        )}

        {status === "loading" || status === "idle" ? (
          <div role="status" className="flex flex-col items-center gap-3 py-20 text-sm text-gray">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-primary" />
            Loading your favorites...
          </div>
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
