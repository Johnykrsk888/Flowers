import type { CatalogProduct } from "@/moysklad/mapProduct";

/**
 * Каталог из локальной БД (сервер Express). В dev Vite проксирует /api/catalog и /uploads.
 */
export function catalogApiBase(): string {
  const v = (import.meta.env.VITE_CATALOG_API_URL as string | undefined)?.trim();
  if (v) return v.replace(/\/$/, "");
  return "";
}

export async function fetchCatalogFromDb(): Promise<{
  products: CatalogProduct[];
  folderPaths: string[];
}> {
  const base = catalogApiBase();
  const url = `${base}/api/catalog/products`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Каталог БД: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    products: CatalogProduct[];
    folderPaths: string[];
  };
  return {
    products: data.products ?? [],
    folderPaths: data.folderPaths ?? [],
  };
}

export async function postCatalogSync(): Promise<{ ok: boolean; count?: number }> {
  const base = catalogApiBase();
  const res = await fetch(`${base}/api/catalog/sync`, { method: "POST" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Синхронизация: ${res.status} ${t.slice(0, 200)}`);
  }
  return (await res.json()) as { ok: boolean; count?: number };
}
