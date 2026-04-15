-- ============================================================
-- Migration: admin_users → staff_profiles (super admin + permissions)
-- Run in Supabase SQL Editor AFTER this change ships.
-- If you never had admin_users, use supabase-setup.sql instead.
-- ============================================================

-- 1. New table
CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  can_view_dashboard BOOLEAN NOT NULL DEFAULT false,
  can_view_history BOOLEAN NOT NULL DEFAULT false,
  can_manage_reference_prices BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Backfill from legacy admin_users (if table exists)
INSERT INTO staff_profiles (user_id, is_super_admin, can_view_dashboard, can_view_history, can_manage_reference_prices)
SELECT user_id, false, true, true, true
FROM admin_users
ON CONFLICT (user_id) DO NOTHING;

-- 3. Drop old RLS policies that reference admin_users
DROP POLICY IF EXISTS "Admins can read submissions" ON price_submissions;
DROP POLICY IF EXISTS "Admins can update reference_prices" ON reference_prices;
DROP POLICY IF EXISTS "Users can read own admin row" ON admin_users;

-- 4. RLS helpers (SECURITY DEFINER — avoids infinite recursion on staff_profiles policies)
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

DROP POLICY IF EXISTS "staff_reads_own_profile" ON staff_profiles;
DROP POLICY IF EXISTS "super_admin_manage_staff" ON staff_profiles;

CREATE POLICY "staff_reads_own_profile"
  ON staff_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "super_admin_manage_staff"
  ON staff_profiles FOR ALL
  USING (public.staff_requester_is_super_admin())
  WITH CHECK (public.staff_requester_is_super_admin());

-- 5. New data-access policies (replace admin_users checks; use helpers to avoid recursion)
DROP POLICY IF EXISTS "Staff can read submissions" ON price_submissions;
DROP POLICY IF EXISTS "Staff can update reference prices" ON reference_prices;

CREATE POLICY "Staff can read submissions"
  ON price_submissions FOR SELECT
  USING (public.staff_requester_can_read_submissions());

CREATE POLICY "Staff can update reference prices"
  ON reference_prices FOR UPDATE
  USING (public.staff_requester_can_update_reference_prices())
  WITH CHECK (public.staff_requester_can_update_reference_prices());

-- 6. Drop legacy table (optional; comment out if you want to keep for audit)
DROP TABLE IF EXISTS admin_users;

-- 7. Bootstrap staff (UUID must match Auth → Users for that email; copy from there)
--
-- New row: you MUST set at least one permission flag to true (defaults are all false).
-- INSERT INTO staff_profiles (user_id, is_super_admin, can_view_dashboard, can_view_history, can_manage_reference_prices)
-- VALUES ('PASTE_UUID_FROM_AUTHENTICATION_USERS', true, true, true, true)
-- ON CONFLICT (user_id) DO UPDATE SET
--   is_super_admin = EXCLUDED.is_super_admin,
--   can_view_dashboard = EXCLUDED.can_view_dashboard,
--   can_view_history = EXCLUDED.can_view_history,
--   can_manage_reference_prices = EXCLUDED.can_manage_reference_prices;
--
-- Or update an existing row that only had user_id:
-- UPDATE staff_profiles SET
--   is_super_admin = true,
--   can_view_dashboard = true,
--   can_view_history = true,
--   can_manage_reference_prices = true
-- WHERE user_id = 'YOUR_USER_UUID_HERE';
