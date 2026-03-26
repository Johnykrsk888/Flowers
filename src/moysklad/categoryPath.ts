/** Разделитель сегментов пути каталога (как в UI, без зависимости от `/` в ответе API). */
export const CATEGORY_PATH_SEP = " / ";

/**
 * Нормализует pathName из МойСклад (`Группа/Подгруппа`) в единый вид для категорий и фильтра.
 */
export function normalizePathFromApi(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const segments = t.split("/").map((s) => s.trim()).filter(Boolean);
  if (!segments.length) return null;
  return segments.join(CATEGORY_PATH_SEP);
}

/** Путь группы по полю pathName или по цепочке родителей (productFolder → родитель). */
export function resolvePathFromFolderLike(
  row: {
    pathName?: string;
    name?: string;
    productFolder?: unknown;
  } | null | undefined,
  depth = 0
): string | null {
  if (!row || depth > 10) return null;
  const direct = normalizePathFromApi(row.pathName);
  if (direct) return direct;
  const parentRaw = row.productFolder;
  const parent =
    parentRaw && typeof parentRaw === "object" && parentRaw !== null
      ? (parentRaw as {
          pathName?: string;
          name?: string;
          productFolder?: unknown;
        })
      : null;
  const parentPath = parent ? resolvePathFromFolderLike(parent, depth + 1) : null;
  const leaf = row.name?.trim();
  if (parentPath && leaf) return `${parentPath}${CATEGORY_PATH_SEP}${leaf}`;
  return normalizePathFromApi(row.name) ?? (leaf ?? null);
}

/** Сравнение подписей категорий (кириллица, без учёта регистра). */
export function segmentEqualsRu(a: string, b: string): boolean {
  return (
    a.trim().localeCompare(b.trim(), "ru", { sensitivity: "accent" }) === 0
  );
}

/** Последний сегмент пути («Букеты» из «Цветы / Букеты»). */
export function lastCategorySegment(path: string): string | undefined {
  const parts = path.split(CATEGORY_PATH_SEP).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : undefined;
}

/**
 * Товар относится к выбранной группе:
 * — точное совпадение пути;
 * — товар в подпапке выбранной группы;
 * — если в фильтре короткое имя («Букеты»), а у товара полный путь («Цветы / Букеты») — совпадение по последнему сегменту.
 */
export function productMatchesCategoryPath(
  productCategory: string,
  selected: string
): boolean {
  if (selected === "Все") return true;
  if (segmentEqualsRu(productCategory, selected)) return true;
  if (productCategory.startsWith(selected + CATEGORY_PATH_SEP)) return true;
  const selectedIsShort =
    !selected.includes(CATEGORY_PATH_SEP) && selected.trim() !== "";
  if (selectedIsShort) {
    const last = lastCategorySegment(productCategory);
    if (last != null && segmentEqualsRu(last, selected)) return true;
  }
  return false;
}
