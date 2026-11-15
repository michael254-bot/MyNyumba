-- "House taken" flow: Mark as let / Relist, tenant reports, 30-day check-ins, 90-day archive.
-- Run this BEFORE deploying the code that uses it. Safe to re-run.

-- 1. New listing statuses: 'let' (taken, hidden from search) and 'archived' (let for 90+ days)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.listings'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.listings DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
  CHECK (status IN ('pending','active','inactive','rejected','let','archived'));

-- 2. Tracking columns
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS let_at             TIMESTAMPTZ;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS last_confirmed_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS auto_hidden_reason VARCHAR(40);
-- Existing listings start their 30-day clock today, so nothing is hidden the day you deploy
UPDATE public.listings SET last_confirmed_at = NOW() WHERE last_confirmed_at IS NULL;

-- 3. Tenant reports ("already taken", "wrong number")
CREATE TABLE IF NOT EXISTS public.listing_reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      VARCHAR(20) NOT NULL CHECK (reason IN ('taken','wrong_number','other')),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (listing_id, tenant_id)
);
-- Reports are written and read only by the backend, never through the public REST API
ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

-- 4. Indexes for the daily clean-up and the dashboards
CREATE INDEX IF NOT EXISTS idx_listings_status_confirmed ON public.listings (status, last_confirmed_at);
CREATE INDEX IF NOT EXISTS idx_listings_status_let_at    ON public.listings (status, let_at);
CREATE INDEX IF NOT EXISTS idx_reports_listing_open      ON public.listing_reports (listing_id) WHERE resolved_at IS NULL;

-- Check
SELECT status, COUNT(*) FROM public.listings GROUP BY status ORDER BY status;
