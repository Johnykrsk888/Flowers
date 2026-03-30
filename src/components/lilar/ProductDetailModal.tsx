import { useEffect, useState, type SyntheticEvent } from 'react';
import { X, Heart, Minus, Plus, Phone, Check, Package } from 'lucide-react';
import { catalogApiBase } from '@/catalog/fetchCatalog';
import type { CatalogProduct } from '@/moysklad/mapProduct';
import { fetchMoyskladProductGalleryImages } from '@/moysklad/fetchProductGallery';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/moysklad/placeholderImage';
import { ImageLightbox } from './ImageLightbox';
import { galleryUrls } from './productGallery';

type TabId = 'desc' | 'spec' | 'care';

type Props = {
  product: CatalogProduct | null;
  open: boolean;
  onClose: () => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onAddToCart: (p: CatalogProduct, quantity: number) => void;
  onImageError: (e: SyntheticEvent<HTMLImageElement>) => void;
  phoneHref?: string;
  phoneLabel?: string;
};

/**
 * Карточка товара в духе страницы товара lilar.ru: фото, цена, количество, вкладки.
 */
export function ProductDetailModal({
  product,
  open,
  onClose,
  favorites,
  onToggleFavorite,
  onAddToCart,
  onImageError,
  phoneHref = 'tel:+78001234567',
  phoneLabel = '8 800 123-45-67',
}: Props) {
  const [tab, setTab] = useState<TabId>('desc');
  const [qty, setQty] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const mainSrc = images[activeImageIdx] ?? images[0];
  // Даже если картинка одна — показываем миниатюру (иначе пользователь думает,
  // что галерея "не загрузилась").
  const showThumbs = images.length > 0;

  useEffect(() => {
    if (!open || !product) {
      setImages([]);
      return;
    }

    const initialImages = galleryUrls(product);
    setQty(1);
    setTab('desc');
    setActiveImageIdx(0);
    setLightboxOpen(false);
    setImages(initialImages);

    let cancelled = false;
    void (async () => {
      try {
        const base = catalogApiBase();
        const res = await fetch(
          `${base}/api/catalog/product-images?id=${encodeURIComponent(product.id)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { images?: unknown };
        const nextImages = Array.isArray(data.images)
          ? data.images
              .map((x) => (typeof x === 'string' ? x.trim() : ''))
              .filter(Boolean)
          : [];
        const merged = Array.from(new Set([...initialImages, ...nextImages]));
        if (!cancelled && merged.length > 0) {
          setImages(merged);
        }

        if (merged.length > 1) return;

        const remoteImages = await fetchMoyskladProductGalleryImages(product.id);
        if (cancelled || !remoteImages?.length) return;
        const mergedRemote = Array.from(new Set([...merged, ...remoteImages]));
        if (mergedRemote.length > merged.length) {
          setImages(mergedRemote);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, product?.id]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (lightboxOpen) {
        setLightboxOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, lightboxOpen]);

  if (!open || !product) return null;

  const discount =
    product.oldPrice != null && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;

  const priceLine =
    product.price > 0
      ? `${product.price.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`
      : '—';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="relative flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[min(92dvh,900px)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--lilar-border)] px-4 py-3 sm:px-6">
          <p className="truncate text-xs text-[var(--lilar-muted)] sm:text-sm">{product.category}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-4 sm:gap-8 sm:p-6 lg:grid-cols-2 lg:items-start">
            <div className="flex w-full max-w-lg flex-col gap-2 lg:max-w-none">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#f0ebe4]">
                <button
                  type="button"
                  className="absolute inset-0 z-[1] cursor-zoom-in"
                  aria-label="Открыть фото на весь экран"
                  onClick={() => setLightboxOpen(true)}
                />
                <img
                  src={mainSrc || PRODUCT_IMAGE_PLACEHOLDER}
                  alt=""
                  className="pointer-events-none h-full w-full object-cover object-center"
                  onError={onImageError}
                  decoding="async"
                />
                {discount > 0 && (
                  <span className="absolute left-3 top-3 z-[2] rounded bg-[var(--lilar-sale)] px-2 py-1 text-xs font-bold text-white">
                    -{discount}%
                  </span>
                )}
              </div>
              {showThumbs && (
                <div className="flex flex-wrap gap-2">
                  {images.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={() => setActiveImageIdx(i)}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-white sm:h-16 sm:w-16 ${
                        i === activeImageIdx
                          ? 'border-[var(--lilar-primary)] ring-1 ring-[var(--lilar-primary)]'
                          : 'border-[var(--lilar-border)] opacity-80 hover:opacity-100'
                      }`}
                      aria-label={`Фото ${i + 1}`}
                    >
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={onImageError}
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-4">
              <h1
                id="product-detail-title"
                className="text-xl font-bold uppercase leading-tight tracking-wide text-[var(--lilar-text)] sm:text-2xl"
              >
                {product.name}
              </h1>

              <div className="flex flex-wrap items-end gap-3">
                <span className="text-3xl font-bold text-[var(--lilar-text)]">{priceLine}</span>
                {product.oldPrice != null && product.oldPrice > product.price && (
                  <span className="text-lg text-neutral-400 line-through">
                    {product.oldPrice.toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </div>

              <ul className="space-y-1 text-sm text-[var(--lilar-muted)]">
                {product.code != null && product.code !== '' && (
                  <li>
                    Код товара: <span className="font-medium text-[var(--lilar-text)]">{product.code}</span>
                  </li>
                )}
                <li className="flex items-center gap-2 text-emerald-700">
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                  В наличии
                </li>
              </ul>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="inline-flex items-center rounded-full border border-[var(--lilar-border)] bg-[var(--lilar-bg)]">
                  <button
                    type="button"
                    className="px-3 py-2 text-neutral-600 hover:bg-white/80 disabled:opacity-40"
                    aria-label="Меньше"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    className="px-3 py-2 text-neutral-600 hover:bg-white/80"
                    aria-label="Больше"
                    onClick={() => setQty((q) => q + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={product.price <= 0}
                  onClick={() => onAddToCart(product, qty)}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-[var(--lilar-primary)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--lilar-primary-hover)] disabled:opacity-40 sm:flex-none sm:min-w-[180px]"
                >
                  В корзину
                </button>
                <a
                  href={phoneHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--lilar-primary)] px-6 py-3 text-sm font-semibold text-[var(--lilar-primary)] transition hover:bg-[var(--lilar-bg)]"
                >
                  <Phone className="h-4 w-4" />
                  Быстрый заказ
                </a>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(product.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--lilar-border)] px-4 py-3 text-sm font-medium text-[var(--lilar-text)] hover:border-[var(--lilar-primary)]"
                  aria-label="В избранное"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      favorites.includes(product.id)
                        ? 'fill-[var(--lilar-primary)] text-[var(--lilar-primary)]'
                        : 'text-neutral-500'
                    }`}
                  />
                  Избранное
                </button>
              </div>

              <div className="rounded-xl border border-[var(--lilar-border)] bg-[var(--lilar-bg)]/80 p-4 text-sm">
                <p className="mb-2 font-semibold text-[var(--lilar-text)]">Сервис</p>
                <ul className="space-y-2 text-[var(--lilar-muted)]">
                  <li className="flex gap-2">
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lilar-primary)]" aria-hidden />
                    Актуальное фото и состав из каталога МойСклад
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lilar-primary)]" aria-hidden />
                    Оформление заказа в корзине — уточним доставку по телефону {phoneLabel}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--lilar-border)] px-4 pb-6 pt-2 sm:px-6">
            <div className="flex flex-wrap gap-1 border-b border-[var(--lilar-border)]">
              {(
                [
                  ['desc', 'Описание'],
                  ['spec', 'Характеристики'],
                  ['care', 'Уход'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`px-4 py-3 text-sm font-semibold transition-colors ${
                    tab === id
                      ? 'border-b-2 border-[var(--lilar-primary)] text-[var(--lilar-primary)]'
                      : 'text-[var(--lilar-muted)] hover:text-[var(--lilar-text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-w-none pt-4 text-[var(--lilar-text)]">
              {tab === 'desc' && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--lilar-muted)]">
                  {product.description}
                </p>
              )}
              {tab === 'spec' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[280px] border-collapse text-sm">
                    <tbody className="divide-y divide-[var(--lilar-border)]">
                      <tr>
                        <th className="bg-[var(--lilar-bg)] py-2 pr-4 text-left font-medium text-[var(--lilar-text)]">
                          Группа
                        </th>
                        <td className="py-2 text-[var(--lilar-muted)]">{product.category}</td>
                      </tr>
                      {product.code != null && product.code !== '' && (
                        <tr>
                          <th className="bg-[var(--lilar-bg)] py-2 pr-4 text-left font-medium text-[var(--lilar-text)]">
                            Код
                          </th>
                          <td className="py-2 font-mono text-[var(--lilar-muted)]">{product.code}</td>
                        </tr>
                      )}
                      {product.article != null && product.article !== '' && (
                        <tr>
                          <th className="bg-[var(--lilar-bg)] py-2 pr-4 text-left font-medium text-[var(--lilar-text)]">
                            Артикул
                          </th>
                          <td className="py-2 font-mono text-[var(--lilar-muted)]">{product.article}</td>
                        </tr>
                      )}
                      {product.barcodes != null && product.barcodes !== '' && (
                        <tr>
                          <th className="bg-[var(--lilar-bg)] py-2 pr-4 text-left font-medium text-[var(--lilar-text)]">
                            Штрихкод
                          </th>
                          <td className="py-2 font-mono text-[var(--lilar-muted)]">{product.barcodes}</td>
                        </tr>
                      )}
                      {product.weightKg != null && product.weightKg > 0 && (
                        <tr>
                          <th className="bg-[var(--lilar-bg)] py-2 pr-4 text-left font-medium text-[var(--lilar-text)]">
                            Вес
                          </th>
                          <td className="py-2 text-[var(--lilar-muted)]">
                            {product.weightKg < 1
                              ? `${Math.round(product.weightKg * 1000)} г`
                              : `${product.weightKg.toFixed(2)} кг`}
                          </td>
                        </tr>
                      )}
                      {product.salePricesLabels.map((sp, i) => (
                        <tr key={i}>
                          <th className="bg-[var(--lilar-bg)] py-2 pr-4 text-left font-medium text-[var(--lilar-text)]">
                            {sp.label}
                          </th>
                          <td className="py-2 text-[var(--lilar-muted)]">
                            {sp.rub.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === 'care' && (
                <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--lilar-muted)]">
                  <li>Снимите упаковку с букета при получении.</li>
                  <li>Переставьте цветы в вазу с прохладной водой.</li>
                  <li>Регулярно меняйте воду и подрезайте стебли.</li>
                  <li>Держите подальше от батарей, прямого солнца и сквозняков.</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <ImageLightbox
        open={lightboxOpen}
        src={mainSrc || PRODUCT_IMAGE_PLACEHOLDER}
        alt={product.name}
        onClose={() => setLightboxOpen(false)}
        suppressEscape
      />
    </div>
  );
}
