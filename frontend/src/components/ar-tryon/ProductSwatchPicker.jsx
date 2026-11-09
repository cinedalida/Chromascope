import { Heart } from "lucide-react";
import { shadeToFavoriteItem, useFavorites } from "../../hooks/useFavorites.js";

// Heart for the selected shade (Part B, Phase F4): saves that one shade as a product favorite. Signed in only (B1).
export function ShadeFavoriteButton({ shade }) {
  const { signedIn, isFavorite, toggleProduct } = useFavorites();
  if (!signedIn || !shade?.region) return null;
  const item = shadeToFavoriteItem(shade.region, shade);
  const active = isFavorite(item.product_id, item.shade_id);
  const name = shade.shade || shade.product;
  return (
    <button
      type="button"
      onClick={() => toggleProduct(item)}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className="-my-1 shrink-0 rounded-full p-2 transition hover:bg-gray-lightest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Heart aria-hidden="true" strokeWidth={2} className={`h-5 w-5 ${active ? "fill-current text-danger" : "text-gray"}`} />
    </button>
  );
}
