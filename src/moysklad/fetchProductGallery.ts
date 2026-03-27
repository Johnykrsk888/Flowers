import { moyskladApiPrefix } from "./apiPrefix";
import { fetchEntityWithImagesExpanded } from "./fetchEntityRows";
import { mapMsProduct } from "./mapProduct";

/**
 * Полная галерея по id товара/комплекта (GET с expand=images).
 * Нужна, если в списке пришла неполная images.rows, а в карточке нужны миниатюры.
 */
export async function fetchMoyskladProductGalleryImages(
  msId: string
): Promise<string[] | null> {
  if (!moyskladApiPrefix()) return null;
  const p =
    (await fetchEntityWithImagesExpanded("product", msId)) ??
    (await fetchEntityWithImagesExpanded("bundle", msId));
  if (!p) return null;
  return mapMsProduct(p, undefined).images;
}
