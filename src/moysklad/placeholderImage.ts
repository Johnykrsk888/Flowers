/** Заглушки для карточек — data URI. Герой: файл в /public (см. hero-bouquet.png). */

export const PRODUCT_IMAGE_PLACEHOLDER_DATA =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:#fce7f3"/><stop offset="100%" style="stop-color:#fbcfe8"/>
  </linearGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <text x="200" y="190" text-anchor="middle" fill="#9f1239" font-family="system-ui,sans-serif" font-size="15">Нет фото</text>
  <text x="200" y="218" text-anchor="middle" fill="#be185d" font-family="system-ui,sans-serif" font-size="12">МойСклад</text>
</svg>`
  );

export const PRODUCT_IMAGE_PLACEHOLDER = PRODUCT_IMAGE_PLACEHOLDER_DATA;

/** Герой-секция: фото в public (не inline SVG). */
export const HERO_IMAGE_URL = '/hero-bouquet.png';

/** Запасной градиент, если файл не загрузился. */
export const HERO_FALLBACK_DATA =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:#fff1f2"/><stop offset="100%" style="stop-color:#fbcfe8"/>
  </linearGradient></defs>
  <rect width="600" height="600" rx="48" fill="url(#g)"/>
</svg>`
  );
