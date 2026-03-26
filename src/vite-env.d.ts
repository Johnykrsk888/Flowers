/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOYSKLAD_API_PREFIX?: string;
  /** Опционально: другой префикс API в dev (по умолчанию /api/moysklad). */
  readonly VITE_DEV_MOYSKLAD_PREFIX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
