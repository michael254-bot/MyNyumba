-- MyNyumba Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- COUNTIES TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL
);

-- ─────────────────────────────────────────
-- AREAS TABLE (estates, towns, sub-areas)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    county_id INTEGER REFERENCES counties(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL
);

-- ─────────────────────────────────────────
-- USER PROFILES (extends Supabase auth.users)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(200),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'tenant' CHECK (role IN ('tenant', 'landlord', 'admin')),
    avatar_url TEXT,
    county_id INTEGER REFERENCES counties(id),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- LISTINGS TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    county_id INTEGER REFERENCES counties(id),
    area_id INTEGER REFERENCES areas(id),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    property_type VARCHAR(50) NOT NULL CHECK (property_type IN (
        'bedsitter','studio','1_bedroom','2_bedroom','3_bedroom',
        '4_bedroom','bungalow','maisonette','townhouse','apartment'
    )),
    floor VARCHAR(20),
    monthly_rent INTEGER NOT NULL,
    deposit_months INTEGER DEFAULT 2,
    street_address VARCHAR(300),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    -- Amenities
    has_water BOOLEAN DEFAULT FALSE,
    has_borehole BOOLEAN DEFAULT FALSE,
    has_security BOOLEAN DEFAULT FALSE,
    has_cctv BOOLEAN DEFAULT FALSE,
    has_parking BOOLEAN DEFAULT FALSE,
    has_wifi BOOLEAN DEFAULT FALSE,
    has_electricity_token BOOLEAN DEFAULT FALSE,
    has_generator BOOLEAN DEFAULT FALSE,
    is_furnished BOOLEAN DEFAULT FALSE,
    has_dsq BOOLEAN DEFAULT FALSE,
    has_garbage BOOLEAN DEFAULT FALSE,
    has_caretaker BOOLEAN DEFAULT FALSE,
    has_gym BOOLEAN DEFAULT FALSE,
    has_pool BOOLEAN DEFAULT FALSE,
    has_playground BOOLEAN DEFAULT FALSE,
    is_pet_friendly BOOLEAN DEFAULT FALSE,
    has_balcony BOOLEAN DEFAULT FALSE,
    has_lift BOOLEAN DEFAULT FALSE,
    -- Nearby services
    near_school BOOLEAN DEFAULT FALSE,
    near_hospital BOOLEAN DEFAULT FALSE,
    near_market BOOLEAN DEFAULT FALSE,
    near_matatu BOOLEAN DEFAULT FALSE,
    near_church BOOLEAN DEFAULT FALSE,
    near_water_kiosk BOOLEAN DEFAULT FALSE,
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','inactive','rejected')),
    views INTEGER DEFAULT 0,
    unlock_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- LISTING MEDIA (photos + videos)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    media_type VARCHAR(10) CHECK (media_type IN ('photo','video')),
    url TEXT NOT NULL,
    storage_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- UNLOCKS (tenant pays to see landlord contact)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unlocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    amount INTEGER DEFAULT 500,
    mpesa_checkout_request_id VARCHAR(200),
    mpesa_receipt_number VARCHAR(100),
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(tenant_id, listing_id)
);

-- ─────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, listing_id)
);

-- ─────────────────────────────────────────
-- SEED: All 47 Counties
-- ─────────────────────────────────────────
INSERT INTO counties (name, region, slug) VALUES
('Nairobi','Nairobi Region','nairobi'),
('Kiambu','Central','kiambu'),
('Machakos','Eastern','machakos'),
('Kajiado','Rift Valley','kajiado'),
('Muranga','Central','muranga'),
('Kirinyaga','Central','kirinyaga'),
('Nyandarua','Central','nyandarua'),
('Nyeri','Central','nyeri'),
('Mombasa','Coast','mombasa'),
('Kilifi','Coast','kilifi'),
('Kwale','Coast','kwale'),
('Taita Taveta','Coast','taita-taveta'),
('Tana River','Coast','tana-river'),
('Lamu','Coast','lamu'),
('Nakuru','Rift Valley','nakuru'),
('Uasin Gishu','Rift Valley','uasin-gishu'),
('Kericho','Rift Valley','kericho'),
('Bomet','Rift Valley','bomet'),
('Narok','Rift Valley','narok'),
('Laikipia','Rift Valley','laikipia'),
('Baringo','Rift Valley','baringo'),
('West Pokot','Rift Valley','west-pokot'),
('Elgeyo Marakwet','Rift Valley','elgeyo-marakwet'),
('Nandi','Rift Valley','nandi'),
('Samburu','Rift Valley','samburu'),
('Trans Nzoia','Western','trans-nzoia'),
('Bungoma','Western','bungoma'),
('Kakamega','Western','kakamega'),
('Vihiga','Western','vihiga'),
('Busia','Western','busia'),
('Kisumu','Nyanza','kisumu'),
('Siaya','Nyanza','siaya'),
('Homa Bay','Nyanza','homa-bay'),
('Migori','Nyanza','migori'),
('Kisii','Nyanza','kisii'),
('Nyamira','Nyanza','nyamira'),
('Meru','Eastern','meru'),
('Embu','Eastern','embu'),
('Tharaka Nithi','Eastern','tharaka-nithi'),
('Kitui','Eastern','kitui'),
('Makueni','Eastern','makueni'),
('Isiolo','Eastern','isiolo'),
('Marsabit','Eastern','marsabit'),
('Garissa','North Eastern','garissa'),
('Wajir','North Eastern','wajir'),
('Mandera','North Eastern','mandera'),
('Turkana','Rift Valley','turkana')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────
-- SEED: Nairobi areas
-- ─────────────────────────────────────────
INSERT INTO areas (county_id, name, slug) VALUES
(1,'Westlands','westlands'),(1,'Kasarani','kasarani'),(1,'Roysambu','roysambu'),
(1,'Zimmerman','zimmerman'),(1,'Kahawa West','kahawa-west'),(1,'Ruiru','ruiru'),
(1,'Embakasi','embakasi'),(1,'South B','south-b'),(1,'South C','south-c'),
(1,'Langata','langata'),(1,'Karen','karen'),(1,'Kilimani','kilimani'),
(1,'Parklands','parklands'),(1,'Eastleigh','eastleigh'),(1,'Buruburu','buruburu'),
(1,'Umoja','umoja'),(1,'Donholm','donholm'),(1,'Kibera','kibera'),
(1,'Dagoretti','dagoretti'),(1,'Mathare','mathare'),(1,'Pumwani','pumwani'),
(1,'CBD','cbd'),(1,'Upper Hill','upper-hill'),(1,'Hurlingham','hurlingham'),
(1,'Lavington','lavington'),(1,'Runda','runda'),(1,'Muthaiga','muthaiga'),
(1,'Gigiri','gigiri'),(1,'Spring Valley','spring-valley'),(1,'Kitisuru','kitisuru'),
(1,'Loresho','loresho'),(1,'Waithaka','waithaka'),(1,'Rongai','rongai'),
(1,'Ngong Road','ngong-road'),(1,'Industrial Area','industrial-area'),
(1,'Githurai','githurai'),(1,'Lucky Summer','lucky-summer'),(1,'Komarock','komarock'),
(1,'Fedha','fedha'),(1,'Njiru','njiru')
ON CONFLICT DO NOTHING;

-- Mombasa areas
INSERT INTO areas (county_id, name, slug) VALUES
(9,'Nyali','nyali'),(9,'Tudor','tudor'),(9,'Likoni','likoni'),
(9,'Bamburi','bamburi'),(9,'Kisauni','kisauni'),(9,'Mombasa CBD','mombasa-cbd'),
(9,'Shanzu','shanzu'),(9,'Mtwapa','mtwapa'),(9,'Mikindani','mikindani')
ON CONFLICT DO NOTHING;

-- Kisumu areas
INSERT INTO areas (county_id, name, slug) VALUES
(31,'Milimani','milimani'),(31,'Nyalenda','nyalenda'),(31,'Kisumu CBD','kisumu-cbd'),
(31,'Tom Mboya','tom-mboya'),(31,'Kondele','kondele'),(31,'Manyatta','manyatta')
ON CONFLICT DO NOTHING;

-- Nakuru areas
INSERT INTO areas (county_id, name, slug) VALUES
(15,'Nakuru Town','nakuru-town'),(15,'Naivasha','naivasha'),(15,'Bahati','bahati'),
(15,'Section 58','section-58'),(15,'Pipeline','pipeline-nakuru')
ON CONFLICT DO NOTHING;

-- Kiambu areas
INSERT INTO areas (county_id, name, slug) VALUES
(2,'Thika','thika'),(2,'Ruiru','ruiru-kiambu'),(2,'Limuru','limuru'),
(2,'Kikuyu','kikuyu'),(2,'Githunguri','githunguri'),(2,'Karuri','karuri'),
(2,'Juja','juja'),(2,'Gatundu','gatundu')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'role', 'tenant'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update listing updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update listing rating after review insert/update
CREATE OR REPLACE FUNCTION update_listing_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE listings SET
        average_rating = (SELECT AVG(rating) FROM reviews WHERE listing_id = NEW.listing_id),
        review_count = (SELECT COUNT(*) FROM reviews WHERE listing_id = NEW.listing_id)
    WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review
    AFTER INSERT OR UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_listing_rating();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, only edit own
CREATE POLICY "Public profiles are viewable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Listings: anyone can view active, landlords manage own
CREATE POLICY "Active listings viewable by all" ON listings FOR SELECT USING (status = 'active' OR landlord_id = auth.uid());
CREATE POLICY "Landlords can insert" ON listings FOR INSERT WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "Landlords can update own" ON listings FOR UPDATE USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can delete own" ON listings FOR DELETE USING (auth.uid() = landlord_id);

-- Media: follow listing permissions
CREATE POLICY "Media viewable with listing" ON listing_media FOR SELECT USING (true);
CREATE POLICY "Landlords insert media" ON listing_media FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND landlord_id = auth.uid())
);
CREATE POLICY "Landlords delete own media" ON listing_media FOR DELETE USING (
    EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND landlord_id = auth.uid())
);

-- Unlocks: tenants see own
CREATE POLICY "Tenants see own unlocks" ON unlocks FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "Tenants insert unlocks" ON unlocks FOR INSERT WITH CHECK (auth.uid() = tenant_id);

-- Reviews: all can read, tenants write own
CREATE POLICY "Reviews readable by all" ON reviews FOR SELECT USING (true);
CREATE POLICY "Tenants insert reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = tenant_id);

-- Counties and areas: public read
ALTER TABLE counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Counties public" ON counties FOR SELECT USING (true);
CREATE POLICY "Areas public" ON areas FOR SELECT USING (true);