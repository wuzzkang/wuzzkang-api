-- Drop existing function to change return type from BIGINT to JSONB
DROP FUNCTION IF EXISTS public.deduct_user_balance(UUID, BIGINT, TEXT, UUID, TEXT, JSONB);

-- Update deduct_user_balance to return both new balance and transaction ID
CREATE OR REPLACE FUNCTION public.deduct_user_balance(
  p_user_id UUID,
  p_amount BIGINT,
  p_type TEXT,
  p_project_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance BIGINT;
  v_new_balance BIGINT;
  v_transaction_id UUID;
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
    -p_amount,
    p_type,
    p_project_id,
    p_description,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
END;
$$;
