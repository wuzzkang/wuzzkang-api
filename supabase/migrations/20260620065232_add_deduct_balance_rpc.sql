-- Function to deduct balance and log transaction atomically
CREATE OR REPLACE FUNCTION public.deduct_user_balance(
  p_user_id UUID,
  p_amount BIGINT,
  p_type TEXT,
  p_project_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with service role privileges
AS $$
DECLARE
  v_current_balance BIGINT;
  v_new_balance BIGINT;
BEGIN
  -- 1. Get current balance and lock the row for update
  SELECT balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- 2. Check if profile exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  -- 3. Check if balance is sufficient
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  -- 4. Deduct balance
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE public.profiles
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- 5. Log transaction
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    project_id,
    description,
    metadata
  ) VALUES (
    p_user_id,
    -p_amount, -- Negative for deduction
    p_type,
    p_project_id,
    p_description,
    p_metadata
  );

  RETURN v_new_balance;
END;
$$;

-- Function to get or create profile
CREATE OR REPLACE FUNCTION public.get_or_create_profile(p_user_id UUID)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, balance)
    VALUES (p_user_id, 0)
    RETURNING * INTO v_profile;
  END IF;
  
  RETURN v_profile;
END;
$$;
