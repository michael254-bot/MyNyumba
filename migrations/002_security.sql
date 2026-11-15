-- MyNyumba security hardening for Supabase. Run once in the Supabase SQL editor.
-- Safe to run more than once.
--
-- Why this is safe for the live site: the Flask backend talks to Postgres
-- directly through DATABASE_URL (table owner), which RLS doesn't restrict. Only
-- direct calls to Supabase's REST API with the anon key or a user's token are
-- affected. Those calls are exactly what these policies were leaving open.

-- 1. Nobody can make themselves admin (or any other role) at sign-up.
--    Before: role came straight from user-supplied sign-up metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'landlord' THEN 'landlord' ELSE 'tenant' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Profiles: phone numbers and ID numbers were readable by anyone with the
--    anon key. Now each user can only read their own row, and nobody can edit
--    profiles through the REST API (the app does it through the backend).
DROP POLICY IF EXISTS "Public profiles" ON profiles;
DROP POLICY IF EXISTS "Own profile" ON profiles;
CREATE POLICY "Own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Update own profile" ON profiles;

-- 3. Unlocks: a tenant could insert their own row with status 'completed'
--    and get a landlord's number without paying. Inserts now only happen in the backend.
DROP POLICY IF EXISTS "Tenants insert unlock" ON unlocks;

-- 4. Reviews: could be posted without unlocking first. Backend only now.
DROP POLICY IF EXISTS "Tenants insert review" ON reviews;

-- 5. Listings and media: writes go through the backend, which checks ownership
--    and validates fields. Public read of active listings stays.
DROP POLICY IF EXISTS "Landlords insert" ON listings;
DROP POLICY IF EXISTS "Landlords update own" ON listings;
DROP POLICY IF EXISTS "Landlords delete own" ON listings;
DROP POLICY IF EXISTS "Landlords insert media" ON listing_media;
DROP POLICY IF EXISTS "Landlords delete media" ON listing_media;

-- 6. Make sure RLS is on everywhere (no-op if it already is).
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE counties      ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas         ENABLE ROW LEVEL SECURITY;

-- 7. Check what's left. Expect only SELECT policies, plus nothing on storage.objects
--    that lets anon/authenticated INSERT into the listing-media bucket (uploads use
--    signed URLs created by the backend, so no insert policy is needed).
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, cmd;
