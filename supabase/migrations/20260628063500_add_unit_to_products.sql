-- Add unit column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'Halaman';

-- Update existing products with their appropriate units
UPDATE products SET unit = 'Undangan' WHERE id = 'wedding';
UPDATE products SET unit = 'Toko' WHERE id = 'store';
