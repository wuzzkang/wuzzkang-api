-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  page_data JSONB NOT NULL,
  repo_url TEXT,
  live_url TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policies (simplified for backend service role access)
-- Note: Service role bypasses RLS, but it's good practice to have policies.
CREATE POLICY "Service role can do everything" ON projects
  USING (true)
  WITH CHECK (true);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Create products table to manage template types
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  cost INTEGER DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial products
INSERT INTO products (id, name, is_active, cost) VALUES
  ('store', 'Toko Online / Bisnis', TRUE, 10000),
  ('wedding', 'Undangan Pernikahan', TRUE, 10000)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  cost = EXCLUDED.cost;
