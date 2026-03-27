import { Heart, Plus } from "lucide-react";
import type { SyntheticEvent } from "react";
import type { CatalogProduct } from "@/moysklad/mapProduct";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/moysklad/placeholderImage";

type Props = {
  product: CatalogProduct;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onAddToCart: (p: CatalogProduct) => void;
  onImageError: (e: SyntheticEvent<HTMLImageElement>) => void;
  /** Компактная сетка как на витрине-референсе */
  compact?: boolean;
};

export function LilarProductCard({
  product,
  favorites,
  onToggleFavorite,
  onAddToCart,
  onImageError,
  compact = false,
}: Props) {
  const discount =
    product.oldPrice != null && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;

  return (
    <article
      className={`group flex flex-col bg-[var(--lilar-card)] rounded-lg border border-[var(--lilar-border)] shadow-sm hover:shadow-md transition-shadow overflow-hidden ${compact ? "" : ""}`}
    >
      <div className="relative aspect-square bg-[#f0ebe4] overflow-hidden">
        <img
          src={product.image || PRODUCT_IMAGE_PLACEHOLDER}
          alt={product.name}
          onError={onImageError}
          decoding="async"
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {discount > 0 && (
          <span className="absolute top-2 left-2 rounded bg-[var(--lilar-sale)] text-white text-xs font-bold px-2 py-0.5">
            -{discount}%
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggleFavorite(product.id)}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow hover:scale-105 transition-transform"
          aria-label="В избранное"
        >
          <Heart
            className={`w-4 h-4 ${
              favorites.includes(product.id)
                ? "fill-[var(--lilar-primary)] text-[var(--lilar-primary)]"
                : "text-neutral-500"
            }`}
          />
        </button>
      </div>
      <div className="flex flex-col flex-1 p-3 sm:p-4">
        <h3 className="text-sm sm:text-[15px] font-semibold text-[var(--lilar-text)] leading-snug line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            {product.oldPrice != null && product.oldPrice > product.price && (
              <div className="text-xs text-neutral-400 line-through">
                {product.oldPrice.toLocaleString("ru-RU")} ₽
              </div>
            )}
            <div className="text-lg font-bold text-[var(--lilar-text)]">
              {product.price > 0
                ? `${product.price.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`
                : "—"}
            </div>
          </div>
          <button
            type="button"
            disabled={product.price <= 0}
            onClick={() => onAddToCart(product)}
            className="shrink-0 w-10 h-10 rounded-full bg-[var(--lilar-primary)] text-white flex items-center justify-center hover:bg-[var(--lilar-primary-hover)] disabled:opacity-40 transition-colors"
            aria-label="В корзину"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </article>
  );
}
