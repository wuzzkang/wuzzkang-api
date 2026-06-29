-- 1. Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to system settings for all authenticated users"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

-- Insert initial values
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('daily_ai_limit', '15'::jsonb, 'Default daily free AI generation limit per user'),
  ('ai_generate_cost', '100'::jsonb, 'Default cost in IDR per paid AI generation after daily free quota is exhausted')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, description = EXCLUDED.description;

-- 2. Alter profiles table to make columns nullable and default to NULL
ALTER TABLE public.profiles ALTER COLUMN daily_ai_limit DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN daily_ai_limit DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN daily_ai_limit SET DEFAULT NULL;

ALTER TABLE public.profiles ALTER COLUMN ai_generate_cost DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN ai_generate_cost DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN ai_generate_cost SET DEFAULT NULL;

-- 3. Backfill existing profiles to NULL so they inherit global settings
UPDATE public.profiles
SET daily_ai_limit = NULL,
    ai_generate_cost = NULL;

-- 4. Update the trigger function to insert NULL for these columns on new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, balance, email, full_name, avatar_url, daily_ai_limit, ai_generate_cost, updated_at)
  VALUES (
    NEW.id,
    0, -- Initial balance
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NULL, -- daily_ai_limit (fallback to system settings)
    NULL, -- ai_generate_cost (fallback to system settings)
    NOW()
  );
  RETURN NEW;
END;
$$;
