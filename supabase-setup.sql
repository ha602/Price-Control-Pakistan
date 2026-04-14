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

-- 5. Staff profiles (super admin + per-permission flags; see supabase-staff-roles.sql for migration)
CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  can_view_dashboard BOOLEAN NOT NULL DEFAULT false,
  can_view_history BOOLEAN NOT NULL DEFAULT false,
  can_manage_reference_prices BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS helpers: avoid infinite recursion (policies must not subquery staff_profiles without SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.staff_requester_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.staff_profiles WHERE user_id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_requester_can_read_submissions()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles s
    WHERE s.user_id = auth.uid()
      AND (s.is_super_admin OR s.can_view_dashboard OR s.can_view_history)
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_requester_can_update_reference_prices()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles s
    WHERE s.user_id = auth.uid()
      AND (s.is_super_admin OR s.can_manage_reference_prices)
  );
$$;

GRANT EXECUTE ON FUNCTION public.staff_requester_is_super_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_requester_can_read_submissions() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_requester_can_update_reference_prices() TO anon, authenticated, service_role;

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_reads_own_profile"
  ON staff_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "super_admin_manage_staff"
  ON staff_profiles FOR ALL
  USING (public.staff_requester_is_super_admin())
  WITH CHECK (public.staff_requester_is_super_admin());

-- 6. Enable Row Level Security (RLS)
ALTER TABLE price_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_prices ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "Allow public read on submissions" ON price_submissions;
DROP POLICY IF EXISTS "Admins can read submissions" ON price_submissions;
DROP POLICY IF EXISTS "Staff can read submissions" ON price_submissions;

CREATE POLICY "Staff can read submissions"
  ON price_submissions FOR SELECT
  USING (public.staff_requester_can_read_submissions());

CREATE POLICY "Allow public insert on submissions"
  ON price_submissions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on reference_prices"
  ON reference_prices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update reference_prices" ON reference_prices;
DROP POLICY IF EXISTS "Staff can update reference prices" ON reference_prices;

CREATE POLICY "Staff can update reference prices"
  ON reference_prices FOR UPDATE
  USING (public.staff_requester_can_update_reference_prices())
  WITH CHECK (public.staff_requester_can_update_reference_prices());

-- 8. Enable Realtime on price_submissions (ignore error if already added)
ALTER PUBLICATION supabase_realtime ADD TABLE price_submissions;

-- ============================================================
-- Create first Auth user (Authentication), then run:
--   INSERT INTO staff_profiles (user_id, is_super_admin, can_view_dashboard, can_view_history, can_manage_reference_prices)
--   VALUES ('<uuid>', true, true, true, true);
-- Or promote in SQL: UPDATE staff_profiles SET ... WHERE user_id = '...';
-- Enable Email provider under Authentication → Providers.
-- ============================================================
