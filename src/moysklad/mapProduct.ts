import type { MsProduct } from "./types";

/** Цены в МойСклад — в копейках (документация API Remap 1.2) */
export function kopecksToRubles(value: number): number {
  return Math.round(value) / 100;
}

function pickImageUrl(p: MsProduct): string {
  const rows = p.images?.rows;
  if (rows?.length) {
    const first = rows[0];
    const url =
      first.tiny?.href ||
      first.miniature?.downloadHref ||
      first.meta?.downloadHref;
    if (url) return url;
  }
  return "https://images.unsplash.com/photo-1487530811176-3780de880c2d?auto=format&fit=crop&q=80&w=400&h=400";
}

function mainPriceRub(p: MsProduct): number {
  const sp = p.salePrices?.filter((x) => x.value > 0);
  if (sp?.length) {
    return kopecksToRubles(sp[0].value);
  }
  if (p.minPrice && p.minPrice.value > 0) {
    return kopecksToRubles(p.minPrice.value);
  }
  return 0;
}

function formatBarcodes(p: MsProduct): string | undefined {
  if (!p.barcodes?.length) return undefined;
  const parts: string[] = [];
  for (const b of p.barcodes) {
    const v = Object.values(b)[0];
    if (v) parts.push(String(v));
  }
  return parts.length ? parts.join(", ") : undefined;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  rating: number;
  category: string;
  description: string;
  code?: string;
  article?: string;
  externalCode?: string;
  salePricesLabels: { label: string; rub: number }[];
  weightKg?: number;
  barcodes?: string;
}

export function mapMsProduct(p: MsProduct): CatalogProduct {
  const category =
    p.productFolder?.name ||
    (p.pathName ? p.pathName.split("/").filter(Boolean).pop() : undefined) ||
    "Каталог";

  const salePricesLabels =
    p.salePrices?.map((x) => ({
      label: x.priceType?.name || "Цена",
      rub: kopecksToRubles(x.value),
    })) ?? [];

  const price = mainPriceRub(p);

  return {
    id: p.id,
    name: p.name,
    price,
    image: pickImageUrl(p),
    rating: 0,
    category,
    description: (p.description || "").trim() || "Товар из каталога МойСклад",
    code: p.code,
    article: p.article,
    externalCode: p.externalCode,
    salePricesLabels,
    weightKg: p.weight != null && p.weight > 0 ? p.weight / 1000 : undefined,
    barcodes: formatBarcodes(p),
  };
}
