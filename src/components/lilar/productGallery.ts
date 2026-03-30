import type { CatalogProduct } from '@/moysklad/mapProduct';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/moysklad/placeholderImage';

function isDbImagePath(u: string): boolean {
  if (u === PRODUCT_IMAGE_PLACEHOLDER) return true;

  const s = u.trim();

  // БД-прослойка: /uploads/products/....
  if (s.startsWith('/uploads/') || s.includes('/uploads/')) return true;

  // dev/Vite proxy для МойСклад: /api/moysklad/.../download/...
  if (s.startsWith('/api/moysklad') || s.includes('/api/moysklad')) return true;

  // Потоки/другие прокси-эндпойнты для картинок.
  if (s.includes('/download/') || s.includes('/img-proxy')) return true;

  // В некоторых случаях URL могут прийти без ведущего слеша: uploads/products/...
  if (s.startsWith('uploads/')) return true;

  // Абсолютные URL (иногда отдаются сразу в <img>).
  if (/^https?:\/\//i.test(s)) return true;

  return false;
}

function normalizeGalleryUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (s === PRODUCT_IMAGE_PLACEHOLDER) return s;
  if (s.startsWith('/uploads/')) return s;
  if (s.startsWith('uploads/')) return `/${s}`;
  if (/^https?:\/\//i.test(s)) return s;
  return isDbImagePath(s) ? s : '';
}

/** Единый список URL для галереи (МойСклад или БД с одним файлом). */
export function galleryUrls(product: CatalogProduct): string[] {
  if (product.images?.length) {
    const urls = product.images
      .map((x) => (typeof x === 'string' ? normalizeGalleryUrl(x) : ''))
      .filter(Boolean);
    if (urls.length) return urls;
  }

  const one = product.image ? normalizeGalleryUrl(product.image) : '';
  return [one || PRODUCT_IMAGE_PLACEHOLDER];
}
