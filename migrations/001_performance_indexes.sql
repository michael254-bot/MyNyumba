-- Speeds up the queries the site runs on every page view.
-- Safe to run more than once. Run in the Supabase SQL editor.

-- Cover photo lookups (one per listing card) and media on the detail page
CREATE INDEX IF NOT EXISTS idx_listing_media_listing_type_order
  ON listing_media (listing_id, media_type, sort_order);

-- Browse page: active listings, newest first, filtered by county / area / type / rent
CREATE INDEX IF NOT EXISTS idx_listings_status_created   ON listings (status, is_featured DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_county_status    ON listings (county_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_area_status      ON listings (area_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_status_rent      ON listings (status, monthly_rent);
CREATE INDEX IF NOT EXISTS idx_listings_landlord         ON listings (landlord_id, created_at DESC);

-- Areas dropdown and unlock checks
CREATE INDEX IF NOT EXISTS idx_areas_county              ON areas (county_id, name);
CREATE INDEX IF NOT EXISTS idx_unlocks_tenant_listing    ON unlocks (tenant_id, listing_id);
CREATE INDEX IF NOT EXISTS idx_unlocks_checkout          ON unlocks (mpesa_checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing_created   ON reviews (listing_id, created_at DESC);
