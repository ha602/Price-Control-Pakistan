-- Phase 2: canonical cities + area heads (run after supabase-setup.sql)
-- Run in Supabase SQL Editor once when enabling VITE_APP_PHASE=2

-- 1. Staff permission: area monitors admin tab
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS can_manage_area_monitors BOOLEAN NOT NULL DEFAULT false;

-- 2. Cities (canonical names for dropdowns; must match price_submissions.city text)
CREATE TABLE IF NOT EXISTS cities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS city_monitors (
  city_id UUID PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
  head_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cities_sort ON cities (sort_order, name);

-- 3. RLS helper (same pattern as staff_requester_can_update_reference_prices)
CREATE OR REPLACE FUNCTION public.staff_requester_can_manage_area_monitors()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles s
    WHERE s.user_id = auth.uid()
      AND (s.is_super_admin OR s.can_manage_area_monitors)
  );
$$;

GRANT EXECUTE ON FUNCTION public.staff_requester_can_manage_area_monitors() TO anon, authenticated, service_role;

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_monitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cities_select_public" ON cities;
DROP POLICY IF EXISTS "cities_insert_staff" ON cities;
DROP POLICY IF EXISTS "cities_update_staff" ON cities;
DROP POLICY IF EXISTS "cities_delete_staff" ON cities;

CREATE POLICY "cities_select_public"
  ON cities FOR SELECT
  USING (true);

CREATE POLICY "cities_insert_staff"
  ON cities FOR INSERT
  WITH CHECK (public.staff_requester_can_manage_area_monitors());

CREATE POLICY "cities_update_staff"
  ON cities FOR UPDATE
  USING (public.staff_requester_can_manage_area_monitors())
  WITH CHECK (public.staff_requester_can_manage_area_monitors());

CREATE POLICY "cities_delete_staff"
  ON cities FOR DELETE
  USING (public.staff_requester_can_manage_area_monitors());

DROP POLICY IF EXISTS "city_monitors_staff" ON city_monitors;

CREATE POLICY "city_monitors_staff"
  ON city_monitors FOR ALL
  USING (public.staff_requester_can_manage_area_monitors())
  WITH CHECK (public.staff_requester_can_manage_area_monitors());

GRANT SELECT ON cities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON cities TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON city_monitors TO authenticated;

-- 4. Seed cities (matches src/js/config.js CITIES order)
INSERT INTO cities (name, sort_order) VALUES
  ('Karachi', 0),
  ('Lahore', 1),
  ('Islamabad', 2),
  ('Rawalpindi', 3),
  ('Faisalabad', 4),
  ('Multan', 5),
  ('Peshawar', 6),
  ('Quetta', 7),
  ('Hyderabad', 8),
  ('Sialkot', 9),
  ('Gujranwala', 10),
  ('Bahawalpur', 11),
  ('Sargodha', 12),
  ('Sukkur', 13),
  ('Larkana', 14),
  ('Mardan', 15),
  ('Abbottabad', 16),
  ('Dera Ghazi Khan', 17),
  ('Mirpur', 18),
  ('Muzaffarabad', 19)
ON CONFLICT (name) DO NOTHING;

-- 5. Optional: grant area monitors to an existing super admin (uncomment and set email)
-- UPDATE staff_profiles SET can_manage_area_monitors = true
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@example.com' LIMIT 1);
