import { CATEGORY_PATH_SEP, segmentEqualsRu } from "./categoryPath";

/**
 * Корень каталога на сайте (подгруппы внутри него; саму группу в фильтры не показываем).
 * Пустая строка в VITE_MOYSKLAD_CATALOG_ROOT_FOLDER — без ограничения (для отладки).
 */
export function getCatalogRootFolderName(): string | null {
  const raw = import.meta.env.VITE_MOYSKLAD_CATALOG_ROOT_FOLDER;
  if (raw === "") return null;
  const t = (raw ?? "БУМБУКЕТ").trim();
  return t.length > 0 ? t : "БУМБУКЕТ";
}

/** Путь — подгруппа внутри корня (не сама верхняя группа). */
export function pathIsCatalogSubgroup(path: string): boolean {
  const root = getCatalogRootFolderName();
  if (root === null) return true;
  const parts = path.split(CATEGORY_PATH_SEP).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  return segmentEqualsRu(parts[0], root);
}

/** Товар показывать в каталоге: только внутри дерева корня, не только в корневой папке. */
export function productCategoryInCatalogScope(category: string): boolean {
  return pathIsCatalogSubgroup(category);
}
