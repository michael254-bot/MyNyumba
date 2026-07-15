-- MyNyumba Database Schema — Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- COUNTIES
CREATE TABLE IF NOT EXISTS counties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL
);

-- AREAS
CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    county_id INTEGER REFERENCES counties(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL
);

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(200),
    phone VARCHAR(20),
    id_number VARCHAR(30),
    location VARCHAR(200),
    role VARCHAR(20) DEFAULT 'tenant' CHECK (role IN ('tenant','landlord','admin')),
    avatar_url TEXT,
    county_id INTEGER REFERENCES counties(id),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LISTINGS
CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    county_id INTEGER REFERENCES counties(id),
    area_id INTEGER REFERENCES areas(id),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    property_type VARCHAR(50) NOT NULL CHECK (property_type IN (
        'bedsitter','studio','1_bedroom','2_bedroom','3_bedroom',
        '4_bedroom','bungalow','maisonette','townhouse','apartment')),
    floor VARCHAR(20),
    monthly_rent INTEGER NOT NULL,
    deposit_months INTEGER DEFAULT 2,
    street_address VARCHAR(300),
    latitude DECIMAL(9,6), longitude DECIMAL(9,6),
    has_water BOOLEAN DEFAULT FALSE, has_borehole BOOLEAN DEFAULT FALSE,
    has_security BOOLEAN DEFAULT FALSE, has_cctv BOOLEAN DEFAULT FALSE,
    has_parking BOOLEAN DEFAULT FALSE, has_wifi BOOLEAN DEFAULT FALSE,
    has_electricity_token BOOLEAN DEFAULT FALSE, has_generator BOOLEAN DEFAULT FALSE,
    is_furnished BOOLEAN DEFAULT FALSE, has_dsq BOOLEAN DEFAULT FALSE,
    has_garbage BOOLEAN DEFAULT FALSE, has_caretaker BOOLEAN DEFAULT FALSE,
    has_gym BOOLEAN DEFAULT FALSE, has_pool BOOLEAN DEFAULT FALSE,
    has_playground BOOLEAN DEFAULT FALSE, is_pet_friendly BOOLEAN DEFAULT FALSE,
    has_balcony BOOLEAN DEFAULT FALSE, has_lift BOOLEAN DEFAULT FALSE,
    near_school BOOLEAN DEFAULT FALSE, near_hospital BOOLEAN DEFAULT FALSE,
    near_market BOOLEAN DEFAULT FALSE, near_matatu BOOLEAN DEFAULT FALSE,
    near_church BOOLEAN DEFAULT FALSE, near_water_kiosk BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending','active','inactive','rejected')),
    views INTEGER DEFAULT 0, unlock_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0, review_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEDIA
CREATE TABLE IF NOT EXISTS listing_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    media_type VARCHAR(10) CHECK (media_type IN ('photo','video')),
    url TEXT NOT NULL, storage_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UNLOCKS
CREATE TABLE IF NOT EXISTS unlocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    amount INTEGER DEFAULT 500,
    mpesa_checkout_request_id VARCHAR(200),
    mpesa_receipt_number VARCHAR(100),
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ,
    UNIQUE(tenant_id, listing_id)
);

-- REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, listing_id)
);

-- ── SEED: 47 Counties ──────────────────────────────────────────────────────
INSERT INTO counties (name,region,slug) VALUES
('Nairobi','Nairobi Region','nairobi'),('Kiambu','Central','kiambu'),
('Machakos','Eastern','machakos'),('Kajiado','Rift Valley','kajiado'),
('Muranga','Central','muranga'),('Kirinyaga','Central','kirinyaga'),
('Nyandarua','Central','nyandarua'),('Nyeri','Central','nyeri'),
('Mombasa','Coast','mombasa'),('Kilifi','Coast','kilifi'),
('Kwale','Coast','kwale'),('Taita Taveta','Coast','taita-taveta'),
('Tana River','Coast','tana-river'),('Lamu','Coast','lamu'),
('Nakuru','Rift Valley','nakuru'),('Uasin Gishu','Rift Valley','uasin-gishu'),
('Kericho','Rift Valley','kericho'),('Bomet','Rift Valley','bomet'),
('Narok','Rift Valley','narok'),('Laikipia','Rift Valley','laikipia'),
('Baringo','Rift Valley','baringo'),('West Pokot','Rift Valley','west-pokot'),
('Elgeyo Marakwet','Rift Valley','elgeyo-marakwet'),('Nandi','Rift Valley','nandi'),
('Samburu','Rift Valley','samburu'),('Trans Nzoia','Western','trans-nzoia'),
('Bungoma','Western','bungoma'),('Kakamega','Western','kakamega'),
('Vihiga','Western','vihiga'),('Busia','Western','busia'),
('Kisumu','Nyanza','kisumu'),('Siaya','Nyanza','siaya'),
('Homa Bay','Nyanza','homa-bay'),('Migori','Nyanza','migori'),
('Kisii','Nyanza','kisii'),('Nyamira','Nyanza','nyamira'),
('Meru','Eastern','meru'),('Embu','Eastern','embu'),
('Tharaka Nithi','Eastern','tharaka-nithi'),('Kitui','Eastern','kitui'),
('Makueni','Eastern','makueni'),('Isiolo','Eastern','isiolo'),
('Marsabit','Eastern','marsabit'),('Garissa','North Eastern','garissa'),
('Wajir','North Eastern','wajir'),('Mandera','North Eastern','mandera'),
('Turkana','Rift Valley','turkana')
ON CONFLICT (slug) DO NOTHING;

-- ── SEED: Nairobi areas ────────────────────────────────────────────────────
INSERT INTO areas (county_id,name,slug) SELECT id,'Westlands','westlands' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kasarani','kasarani' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Roysambu','roysambu' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Zimmerman','zimmerman' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kahawa West','kahawa-west' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Embakasi','embakasi' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'South B','south-b' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'South C','south-c' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Langata','langata' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Karen','karen' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kilimani','kilimani' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Parklands','parklands' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Eastleigh','eastleigh' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Buruburu','buruburu' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Umoja','umoja' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Donholm','donholm' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kibera','kibera' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Mathare','mathare' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'CBD','cbd' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Upper Hill','upper-hill' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Hurlingham','hurlingham' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Lavington','lavington' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Runda','runda' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Muthaiga','muthaiga' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Gigiri','gigiri' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Spring Valley','spring-valley' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kitisuru','kitisuru' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Loresho','loresho' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Waithaka','waithaka' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Rongai','rongai' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Githurai','githurai' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Lucky Summer','lucky-summer' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Komarock','komarock' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Fedha','fedha' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Njiru','njiru' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Dagoretti','dagoretti' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Pumwani','pumwani' FROM counties WHERE slug='nairobi' ON CONFLICT DO NOTHING;

-- Mombasa
INSERT INTO areas (county_id,name,slug) SELECT id,'Nyali','nyali' FROM counties WHERE slug='mombasa' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Tudor','tudor' FROM counties WHERE slug='mombasa' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Likoni','likoni' FROM counties WHERE slug='mombasa' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Bamburi','bamburi' FROM counties WHERE slug='mombasa' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kisauni','kisauni' FROM counties WHERE slug='mombasa' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Mombasa CBD','mombasa-cbd' FROM counties WHERE slug='mombasa' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Shanzu','shanzu' FROM counties WHERE slug='mombasa' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Mtwapa','mtwapa' FROM counties WHERE slug='mombasa' ON CONFLICT DO NOTHING;

-- Kisumu
INSERT INTO areas (county_id,name,slug) SELECT id,'Milimani','milimani' FROM counties WHERE slug='kisumu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Nyalenda','nyalenda' FROM counties WHERE slug='kisumu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kisumu CBD','kisumu-cbd' FROM counties WHERE slug='kisumu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kondele','kondele' FROM counties WHERE slug='kisumu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Manyatta','manyatta' FROM counties WHERE slug='kisumu' ON CONFLICT DO NOTHING;

-- Nakuru
INSERT INTO areas (county_id,name,slug) SELECT id,'Nakuru Town','nakuru-town' FROM counties WHERE slug='nakuru' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Naivasha','naivasha' FROM counties WHERE slug='nakuru' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Bahati','bahati' FROM counties WHERE slug='nakuru' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Section 58','section-58' FROM counties WHERE slug='nakuru' ON CONFLICT DO NOTHING;

-- Kiambu
INSERT INTO areas (county_id,name,slug) SELECT id,'Thika','thika' FROM counties WHERE slug='kiambu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Ruiru','ruiru' FROM counties WHERE slug='kiambu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Limuru','limuru' FROM counties WHERE slug='kiambu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Kikuyu','kikuyu' FROM counties WHERE slug='kiambu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Juja','juja' FROM counties WHERE slug='kiambu' ON CONFLICT DO NOTHING;
INSERT INTO areas (county_id,name,slug) SELECT id,'Karuri','karuri' FROM counties WHERE slug='kiambu' ON CONFLICT DO NOTHING;

-- ── TRIGGERS ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id,full_name,role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name',
          COALESCE(NEW.raw_user_meta_data->>'role','tenant'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at=NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_listing_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE listings SET
    average_rating=(SELECT AVG(rating) FROM reviews WHERE listing_id=NEW.listing_id),
    review_count=(SELECT COUNT(*) FROM reviews WHERE listing_id=NEW.listing_id)
  WHERE id=NEW.listing_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rating_on_review ON reviews;
CREATE TRIGGER update_rating_on_review
  AFTER INSERT OR UPDATE ON reviews FOR EACH ROW
  EXECUTE FUNCTION update_listing_rating();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles" ON profiles;
CREATE POLICY "Public profiles" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Update own profile" ON profiles;
CREATE POLICY "Update own profile" ON profiles FOR UPDATE USING (auth.uid()=id);

DROP POLICY IF EXISTS "Active listings public" ON listings;
CREATE POLICY "Active listings public" ON listings FOR SELECT USING (status='active' OR landlord_id=auth.uid());
DROP POLICY IF EXISTS "Landlords insert" ON listings;
CREATE POLICY "Landlords insert" ON listings FOR INSERT WITH CHECK (auth.uid()=landlord_id);
DROP POLICY IF EXISTS "Landlords update own" ON listings;
CREATE POLICY "Landlords update own" ON listings FOR UPDATE USING (auth.uid()=landlord_id);
DROP POLICY IF EXISTS "Landlords delete own" ON listings;
CREATE POLICY "Landlords delete own" ON listings FOR DELETE USING (auth.uid()=landlord_id);

DROP POLICY IF EXISTS "Media public" ON listing_media;
CREATE POLICY "Media public" ON listing_media FOR SELECT USING (true);
DROP POLICY IF EXISTS "Landlords insert media" ON listing_media;
CREATE POLICY "Landlords insert media" ON listing_media FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM listings WHERE id=listing_id AND landlord_id=auth.uid()));
DROP POLICY IF EXISTS "Landlords delete media" ON listing_media;
CREATE POLICY "Landlords delete media" ON listing_media FOR DELETE USING (
  EXISTS (SELECT 1 FROM listings WHERE id=listing_id AND landlord_id=auth.uid()));

DROP POLICY IF EXISTS "Tenants unlocks" ON unlocks;
CREATE POLICY "Tenants unlocks" ON unlocks FOR SELECT USING (auth.uid()=tenant_id);
DROP POLICY IF EXISTS "Tenants insert unlock" ON unlocks;
CREATE POLICY "Tenants insert unlock" ON unlocks FOR INSERT WITH CHECK (auth.uid()=tenant_id);

DROP POLICY IF EXISTS "Reviews public" ON reviews;
CREATE POLICY "Reviews public" ON reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Tenants insert review" ON reviews;
CREATE POLICY "Tenants insert review" ON reviews FOR INSERT WITH CHECK (auth.uid()=tenant_id);

DROP POLICY IF EXISTS "Counties public" ON counties;
CREATE POLICY "Counties public" ON counties FOR SELECT USING (true);
DROP POLICY IF EXISTS "Areas public" ON areas;
CREATE POLICY "Areas public" ON areas FOR SELECT USING (true);