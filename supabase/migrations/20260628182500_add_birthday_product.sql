-- Add birthday invitation product type
INSERT INTO products (id, name, is_active, cost, unit)
VALUES ('birthday', 'Undangan Ulang Tahun', TRUE, 19000, 'Undangan')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  cost = EXCLUDED.cost,
  unit = EXCLUDED.unit;
