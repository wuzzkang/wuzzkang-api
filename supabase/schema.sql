-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  page_data JSONB NOT NULL,
  repo_url TEXT,
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
