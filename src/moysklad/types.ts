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
  meta?: { downloadHref?: string };
  title?: string;
  filename?: string;
  tiny?: { href?: string };
  miniature?: { downloadHref?: string };
}

export interface MsImagesBlock {
  meta?: { size?: number };
  rows?: MsImageRow[];
}

export interface MsProductFolder {
  name?: string;
  pathName?: string;
}

export interface MsProduct {
  meta: MsMeta;
  id: string;
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
