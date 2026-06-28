-- Drop tables if they exist to run clean migration
DROP TABLE IF EXISTS coupon_usages CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL, -- 'percentage' or 'fixed_amount'
  discount_value NUMERIC NOT NULL,
  max_uses INT,
  uses_count INT DEFAULT 0,
  max_uses_per_user INT DEFAULT 1,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "Service role can do everything on coupons" ON coupons
  USING (true)
  WITH CHECK (true);

-- Create index for case-insensitive lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_lower ON coupons (LOWER(code));

-- Create coupon usages table
CREATE TABLE IF NOT EXISTS coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "Service role can do everything on coupon_usages" ON coupon_usages
  USING (true)
  WITH CHECK (true);

-- Indexes for performance & validation checks
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id_coupon_id ON coupon_usages(user_id, coupon_id);

-- Seed initial promo codes for testing/use
INSERT INTO coupons (code, discount_type, discount_value, max_uses, max_uses_per_user, expires_at) VALUES
  ('DISKON100', 'percentage', 100, NULL, 1, NULL),
  ('DISKON50', 'percentage', 50, NULL, 3, NULL),
  ('POTONG5000', 'fixed_amount', 5000, 100, 1, NULL)
ON CONFLICT (code) DO NOTHING;
