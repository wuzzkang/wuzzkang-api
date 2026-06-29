-- 1. Add fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_ai_limit INT DEFAULT 15 NOT NULL,
ADD COLUMN IF NOT EXISTS ai_generate_cost BIGINT DEFAULT 100 NOT NULL;

-- 2. Backfill existing profiles
UPDATE public.profiles
SET daily_ai_limit = COALESCE(daily_ai_limit, 15),
    ai_generate_cost = COALESCE(ai_generate_cost, 100);

-- 3. Update the trigger function to copy these fields
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
    15, -- daily_ai_limit
    100, -- ai_generate_cost
    NOW()
  );
  RETURN NEW;
END;
$$;
