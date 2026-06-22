-- Migration: Add Winpay fields to transactions table
-- Date: 2026-06-22

-- 1. Create transaction_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.transaction_status AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS va_number TEXT,
ADD COLUMN IF NOT EXISTS status public.transaction_status DEFAULT 'PENDING';

-- 3. Create index on order_id for faster lookups (especially for webhooks)
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id);
