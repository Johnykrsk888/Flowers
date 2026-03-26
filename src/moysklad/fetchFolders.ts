import { moyskladApiPrefix } from "./apiPrefix";
import { normalizePathFromApi, resolvePathFromFolderLike } from "./categoryPath";
import { msFetchJson } from "./msFetch";
import type { MsProductFolderListResponse } from "./types";

const PAGE_SIZE = 100;

export interface MsFolderMetadata {
  /** Пути всех групп (для фильтров). */
  paths: string[];
  /** id группы → полный путь (список товаров часто без pathName у товара). */
  idToPath: Map<string, string>;
}

function rowToPath(row: {
  id?: string;
  pathName?: string;
  name?: string;
  productFolder?: unknown;
}): string | null {
  return (
    normalizePathFromApi(row.pathName) ?? resolvePathFromFolderLike(row)
  );
}

/** Все группы: пути для UI + соответствие id → путь для маппинга товаров. */
export async function fetchMoyskladFolderMetadata(): Promise<MsFolderMetadata> {
  const prefix = moyskladApiPrefix();
  if (!prefix) {
    return { paths: [], idToPath: new Map() };
  }

  const paths = new Set<string>();
  const idToPath = new Map<string, string>();
  let offset = 0;

  for (;;) {
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      expand: "productFolder",
      filter: "archived=false",
    });

    const url = `${prefix}/entity/productfolder?${qs.toString()}`;
    const res = await msFetchJson(url);

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`МойСклад ${res.status} (productfolder): ${t.slice(0, 200)}`);
    }

    const data = (await res.json()) as MsProductFolderListResponse;
    const rows = data.rows ?? [];

    for (const row of rows) {
      const path = rowToPath(row);
      if (path) {
        paths.add(path);
        if (row.id) idToPath.set(row.id, path);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return {
    paths: Array.from(paths).sort((a, b) => a.localeCompare(b, "ru")),
    idToPath,
  };
}

/** Совместимость: только список путей. */
export async function fetchMoyskladFolderPaths(): Promise<string[]> {
  const m = await fetchMoyskladFolderMetadata().catch(() => null);
  return m?.paths ?? [];
}
