-- Optimized Supabase Schema for Business Intelligence & Bot Performance
-- Run this in the Supabase SQL Editor

-- 1. Enable Foreign Search Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Ensure Users table has required indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- 3. Optimized Customers Table
-- We keep 'id' as TEXT to map directly to Firestore IDs
-- But ensure ownerId uses the UUID from our users table
CREATE INDEX IF NOT EXISTS customers_name_trgm_idx ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_owner_id_idx ON public.customers ("ownerId");

-- 4. Optimized Products Table
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_owner_id_idx ON public.products ("ownerId");

-- 5. Optimized Orders Table
-- Convert 'date' from TEXT to TIMESTAMP for performance
-- Note: This assumes current data is in YYYY-MM-DD format
ALTER TABLE IF EXISTS public.orders 
  ALTER COLUMN "date" TYPE TIMESTAMP USING "date"::TIMESTAMP;

CREATE INDEX IF NOT EXISTS orders_date_idx ON public.orders ("date");
CREATE INDEX IF NOT EXISTS orders_owner_id_idx ON public.orders ("ownerId");
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders ("customerId");

-- 6. Optimized Payments Table
ALTER TABLE IF EXISTS public.payments 
  ALTER COLUMN "date" TYPE TIMESTAMP USING "date"::TIMESTAMP;

CREATE INDEX IF NOT EXISTS payments_date_idx ON public.payments ("date");
CREATE INDEX IF NOT EXISTS payments_customer_id_idx ON public.payments ("customerId");
CREATE INDEX IF NOT EXISTS payments_owner_id_idx ON public.payments ("ownerId");

-- 7. Optimized Cash Book Table
ALTER TABLE IF EXISTS public.cash_book 
  ALTER COLUMN "date" TYPE TIMESTAMP USING "date"::TIMESTAMP;

CREATE INDEX IF NOT EXISTS cash_book_date_idx ON public.cash_book ("date");
CREATE INDEX IF NOT EXISTS cash_book_owner_id_idx ON public.cash_book ("ownerId");

-- 8. Customer Balance View (BI)
-- This view allows the bot to calculate debt in one query instead of summing everything in JS
CREATE OR REPLACE VIEW public.v_customer_balance AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c."ownerId",
    COALESCE(sums.total_ordered, 0) as total_ordered,
    COALESCE(p_sums.total_paid, 0) as total_paid,
    (COALESCE(sums.total_ordered, 0) - COALESCE(p_sums.total_paid, 0)) as current_debt
FROM public.customers c
LEFT JOIN (
    SELECT 
        "customerId",
        SUM("totalAmount") as total_ordered
    FROM public.orders
    GROUP BY "customerId"
) sums ON c.id = sums."customerId"
LEFT JOIN (
    SELECT 
        "customerId",
        SUM(amount) as total_paid
    FROM public.payments
    GROUP BY "customerId"
) p_sums ON c.id = p_sums."customerId";

-- 9. Row Level Security (RLS) - Basic Example
-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Note: In Supabase, the default 'ownerId' check looks like this:
-- CREATE POLICY "User data" ON public.customers FOR ALL USING ("ownerId" = auth.uid());
