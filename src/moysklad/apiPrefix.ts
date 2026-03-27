/** Базовый URL к API МойСклад (dev-прокси или VITE_MOYSKLAD_API_PREFIX). */
export function moyskladApiPrefix(): string {
  // Синхронизация на сервере (tsx): прямой JSON API с Basic auth.
  if (typeof process !== "undefined" && process.env?.MOYSKLAD_SERVER_API_PREFIX) {
    return process.env.MOYSKLAD_SERVER_API_PREFIX.replace(/\/$/, "");
  }
  // В DEV сначала должен быть Vite proxy (/api/moysklad). Если отдать VITE_MOYSKLAD_API_PREFIX
  // (прод URL), браузер с localhost ходит на другой origin → CORS, «Failed to fetch».
  if (import.meta.env.DEV) {
    const override = (import.meta.env.VITE_DEV_MOYSKLAD_PREFIX as string | undefined)?.trim();
    return (override || "/api/moysklad").replace(/\/$/, "");
  }
  const v = (import.meta.env.VITE_MOYSKLAD_API_PREFIX as string | undefined)?.trim();
  if (v) return v.replace(/\/$/, "");
  return "";
}
