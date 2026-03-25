import type { MsProductListResponse } from "./types";
import { mapMsProduct, type CatalogProduct } from "./mapProduct";

/** В dev — прокси Vite `/api/moysklad` (см. vite.config). Для production задайте VITE_MOYSKLAD_API_PREFIX на URL своего бэкенда-прокси. */
function apiPrefix(): string {
  const v = import.meta.env.VITE_MOYSKLAD_API_PREFIX as string | undefined;
  if (v) return v.replace(/\/$/, "");
  if (import.meta.env.DEV) return "/api/moysklad";
  return "";
}

export async function fetchMoyskladProducts(): Promise<CatalogProduct[]> {
  const prefix = apiPrefix();
  if (!prefix) {
    throw new Error(
      "Каталог МойСклад: в production нужен бэкенд-прокси. Укажите VITE_MOYSKLAD_API_PREFIX или запускайте npm run dev с .env (MOYSKLAD_LOGIN, MOYSKLAD_PASSWORD)."
    );
  }

  const qs = new URLSearchParams({
    limit: "100",
    offset: "0",
    expand: "productFolder,images",
    filter: "archived=false",
  });

  const url = `${prefix}/entity/product?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json;charset=utf-8" },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`МойСклад ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as MsProductListResponse;
  const rows = data.rows ?? [];
  return rows.map(mapMsProduct);
}
