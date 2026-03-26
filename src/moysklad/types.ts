/** Фрагменты ответов МойСклад JSON API 1.2 (product) */

export interface MsMeta {
  href: string;
  type?: string;
}

export interface MsPrice {
  value: number;
  priceType?: {
    name?: string;
    id?: string;
  };
}

export interface MsImageRow {
  meta?: { downloadHref?: string; href?: string };
  title?: string;
  filename?: string;
  /** Прямая ссылка на скачивание в некоторых ответах API */
  downloadHref?: string;
  /** Крупнее tiny — для карточек каталога предпочтительнее */
  medium?: { downloadHref?: string; href?: string };
  miniature?: { downloadHref?: string; href?: string };
  /** Самая мелкая превью — только если других нет */
  tiny?: { href?: string; downloadHref?: string };
}

export interface MsImagesBlock {
  meta?: { size?: number; href?: string };
  rows?: MsImageRow[];
}

export interface MsProductFolder {
  meta?: MsMeta;
  id?: string;
  name?: string;
  pathName?: string;
  /** при expand=productFolder — родительская группа */
  productFolder?: MsProductFolder | MsMeta;
}

/** Строка из GET /entity/productfolder */
export interface MsProductFolderRow {
  meta: MsMeta;
  id: string;
  name: string;
  pathName?: string;
  archived?: boolean;
  /** при expand=productFolder */
  productFolder?: MsProductFolder | MsMeta;
}

export interface MsProductFolderListResponse {
  rows: MsProductFolderRow[];
  meta?: { size?: number; limit?: number; offset?: number };
}

export interface MsProduct {
  meta: MsMeta;
  id: string;
  updated?: string;
  name: string;
  code?: string;
  article?: string;
  externalCode?: string;
  archived?: boolean;
  pathName?: string;
  description?: string;
  salePrices?: MsPrice[];
  minPrice?: MsPrice;
  images?: MsImagesBlock;
  productFolder?: MsProductFolder;
  weight?: number;
  barcodes?: Array<Record<string, string>>;
}

export interface MsProductListResponse {
  rows: MsProduct[];
  meta?: { size?: number; limit?: number; offset?: number };
}
