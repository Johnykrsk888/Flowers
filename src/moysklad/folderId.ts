/** UUID группы товаров из meta.href МойСклад. */
export function folderIdFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const m = href.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return m?.[1];
}
