-- База: CREATE DATABASE IF NOT EXISTS boombuket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- GRANT ALL ON boombuket.* TO 'user'@'localhost';

CREATE TABLE IF NOT EXISTS products (
  ms_id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(512) NOT NULL,
  description TEXT,
  category VARCHAR(768) DEFAULT '',
  price DECIMAL(14, 4) NOT NULL DEFAULT 0,
  old_price DECIMAL(14, 4) NULL,
  image_path VARCHAR(1024) NOT NULL DEFAULT '',
  images_json JSON NULL,
  sale_prices_json JSON NULL,
  code VARCHAR(128) NULL,
  article VARCHAR(128) NULL,
  external_code VARCHAR(255) NULL,
  barcodes TEXT NULL,
  weight_kg DECIMAL(14, 6) NULL,
  rating DECIMAL(6, 2) NOT NULL DEFAULT 0,
  updated_at_ms BIGINT NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_products_category (category(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_meta (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
