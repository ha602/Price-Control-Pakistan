-- Fix PostgreSQL 42P17: infinite recursion detected in policy for relation "staff_profiles"
-- Run this in Supabase SQL Editor once if you see that error.

DROP POLICY IF EXISTS "super_admin_manage_staff" ON staff_profiles;
DROP POLICY IF EXISTS "Staff can read submissions" ON price_submissions;
DROP POLICY IF EXISTS "Staff can update reference prices" ON reference_prices;

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

CREATE POLICY "super_admin_manage_staff"
  ON staff_profiles FOR ALL
  USING (public.staff_requester_is_super_admin())
  WITH CHECK (public.staff_requester_is_super_admin());

CREATE POLICY "Staff can read submissions"
  ON price_submissions FOR SELECT
  USING (public.staff_requester_can_read_submissions());

CREATE POLICY "Staff can update reference prices"
  ON reference_prices FOR UPDATE
  USING (public.staff_requester_can_update_reference_prices())
  WITH CHECK (public.staff_requester_can_update_reference_prices());
