-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance BIGINT DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  type TEXT NOT NULL, -- e.g., 'topup', 'payment', 'refund'
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create user_domains table
CREATE TABLE IF NOT EXISTS public.user_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL UNIQUE,
  provider_order_id TEXT,
  expiry_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending', -- e.g., 'active', 'expired', 'pending'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Update projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS custom_domain TEXT,
ADD COLUMN IF NOT EXISTS domain_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS domain_provider_order_id TEXT;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_domains ENABLE ROW LEVEL SECURITY;
-- projects table RLS should already be enabled from previous steps, but let's ensure it.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies

-- Profiles: User can only see and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Transactions: User can only see their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

-- User Domains: User can only see and manage their own domains
CREATE POLICY "Users can view own domains" ON public.user_domains
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own domains" ON public.user_domains
  FOR ALL USING (auth.uid() = user_id);

-- Projects: User can only see and manage their own projects
-- (Assuming projects table uses user_id for ownership)
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
CREATE POLICY "Users can manage own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- 7. Triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
