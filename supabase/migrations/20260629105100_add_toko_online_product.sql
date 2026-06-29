-- Add toko-online product type
INSERT INTO products (id, name, is_active, cost, unit)
VALUES ('toko-online', 'Toko Online', TRUE, 10000, 'Toko')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  cost = EXCLUDED.cost,
  unit = EXCLUDED.unit;
