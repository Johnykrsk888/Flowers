import type { CatalogProduct } from '@/moysklad/mapProduct';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/moysklad/placeholderImage';

/** Единый список URL для галереи (МойСклад или БД с одним файлом). */
export function galleryUrls(product: CatalogProduct): string[] {
  if (product.images?.length) return product.images;
  const one = product.image?.trim();
  return [one || PRODUCT_IMAGE_PLACEHOLDER];
}
