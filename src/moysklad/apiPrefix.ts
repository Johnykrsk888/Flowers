/** Базовый URL к API МойСклад (dev-прокси или VITE_MOYSKLAD_API_PREFIX). */
export function moyskladApiPrefix(): string {
  const v = (import.meta.env.VITE_MOYSKLAD_API_PREFIX as string | undefined)?.trim();
  if (v) return v.replace(/\/$/, "");
  if (import.meta.env.DEV) return "/api/moysklad";
  return "";
}
