-- ============================================================
-- Price Control Pakistan - Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create price_submissions table
CREATE TABLE IF NOT EXISTS price_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  product TEXT NOT NULL,
  submitted_price NUMERIC(10, 2) NOT NULL CHECK (submitted_price > 0),
  unit TEXT NOT NULL DEFAULT 'kg',
  submitter_name TEXT DEFAULT 'Anonymous',
  market_name TEXT DEFAULT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create reference_prices table (official/government prices)
CREATE TABLE IF NOT EXISTS reference_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product TEXT NOT NULL UNIQUE,
  reference_price NUMERIC(10, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Insert default reference prices (PKR)
INSERT INTO reference_prices (product, reference_price, unit) VALUES
  ('Sugar',         120.00, 'kg'),
  ('Atta (Wheat)',  80.00,  'kg'),
  ('Cooking Oil',   320.00, 'litre'),
  ('Rice (Basmati)',250.00, 'kg'),
  ('Tomatoes',       60.00, 'kg'),
  ('Onions',         50.00, 'kg'),
  ('Potatoes',       40.00, 'kg'),
  ('Apples',        200.00, 'kg'),
  ('Milk',          140.00, 'litre'),
  ('Chicken',       450.00, 'kg')
ON CONFLICT (product) DO NOTHING;

-- 4. Create view for city+product averages
CREATE OR REPLACE VIEW city_product_averages AS
SELECT
  city,
  product,
  ROUND(AVG(submitted_price)::NUMERIC, 2) AS avg_price,
  COUNT(*) AS submission_count,
  MIN(submitted_price) AS min_price,
  MAX(submitted_price) AS max_price,
  MAX(submitted_at) AS last_updated
FROM price_submissions
GROUP BY city, product;

-- 5. Admin users (link Supabase Auth users who may access dashboard / history / admin UI)
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own admin row"
  ON admin_users FOR SELECT USING (auth.uid() = user_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE price_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_prices ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "Allow public read on submissions" ON price_submissions;

-- Citizens submit without auth; only staff (rows in admin_users) can read submissions
CREATE POLICY "Admins can read submissions"
  ON price_submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()));

CREATE POLICY "Allow public insert on submissions"
  ON price_submissions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on reference_prices"
  ON reference_prices FOR SELECT USING (true);

CREATE POLICY "Admins can update reference_prices"
  ON reference_prices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()));

-- 8. Enable Realtime on price_submissions (ignore error if already added)
ALTER PUBLICATION supabase_realtime ADD TABLE price_submissions;

-- ============================================================
-- After signup: Authentication → create user, then run:
--   INSERT INTO admin_users (user_id) VALUES ('<uuid from auth.users>');
-- Enable Email provider under Authentication → Providers.
-- ============================================================
