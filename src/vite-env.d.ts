/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOYSKLAD_API_PREFIX?: string;
  /** Опционально: другой префикс API в dev (по умолчанию /api/moysklad). */
  readonly VITE_DEV_MOYSKLAD_PREFIX?: string;
  /** Корень каталога на сайте (подгруппы внутри; верх не в фильтрах). Пустая строка = без фильтра. По умолчанию БУМБУКЕТ. */
  readonly VITE_MOYSKLAD_CATALOG_ROOT_FOLDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
