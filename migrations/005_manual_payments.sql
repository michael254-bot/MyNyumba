-- Manual M-Pesa payments: when the STK prompt doesn't work, a tenant sends Ksh 500 by
-- Send Money and enters the M-Pesa code; the admin checks it and unlocks the house.
-- Run this BEFORE deploying the code that uses it. Safe to re-run.

-- 1. New unlock status 'manual_review' (waiting for the admin to check the code)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.unlocks'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.unlocks DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.unlocks
  ADD CONSTRAINT unlocks_status_check
  CHECK (status IN ('pending','completed','failed','manual_review'));

-- 2. Columns for manual payments and who approved them
ALTER TABLE public.unlocks ADD COLUMN IF NOT EXISTS payment_method      VARCHAR(10) DEFAULT 'stk';
ALTER TABLE public.unlocks ADD COLUMN IF NOT EXISTS manual_code         VARCHAR(12);
ALTER TABLE public.unlocks ADD COLUMN IF NOT EXISTS manual_submitted_at TIMESTAMPTZ;
ALTER TABLE public.unlocks ADD COLUMN IF NOT EXISTS reviewed_at         TIMESTAMPTZ;
ALTER TABLE public.unlocks ADD COLUMN IF NOT EXISTS review_note         TEXT;

-- 3. An M-Pesa code can only ever be used once, so one payment can't unlock two houses
CREATE UNIQUE INDEX IF NOT EXISTS uq_unlocks_manual_code
  ON public.unlocks (upper(manual_code)) WHERE manual_code IS NOT NULL;

-- 4. Admin queue
CREATE INDEX IF NOT EXISTS idx_unlocks_manual_review
  ON public.unlocks (manual_submitted_at) WHERE status = 'manual_review';

-- Check
SELECT status, payment_method, COUNT(*) FROM public.unlocks GROUP BY 1, 2 ORDER BY 1, 2;
