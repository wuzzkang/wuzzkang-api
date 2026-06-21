-- Add order_id column to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Add UNIQUE constraint to prevent duplicate order processing
-- We use a DO block to safely add the constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_order_id'
    ) THEN
        ALTER TABLE public.transactions ADD CONSTRAINT unique_order_id UNIQUE (order_id);
    END IF;
END $$;
