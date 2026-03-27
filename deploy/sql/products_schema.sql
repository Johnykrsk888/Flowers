-- Каталог товаров (PostgreSQL 12+). UTF-8.

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  old_price NUMERIC(12, 2),
  image TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  code TEXT,
  article TEXT,
  external_code TEXT,
  sale_prices_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  weight_kg REAL,
  barcodes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_synced ON products (synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);

COMMENT ON TABLE products IS 'Товары каталога (кэш / синхронизация с МойСклад)';
COMMENT ON COLUMN products.sale_prices_json IS 'JSON [{ "label": "...", "rub": number }]';

ALTER TABLE products OWNER TO flowers_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO flowers_app;
