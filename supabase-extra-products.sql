-- Tier-2 catalog expansion: seed reference prices for newly added products.
-- Run once in the Supabase SQL editor.
-- Adjust prices to match the latest official notification before running.

INSERT INTO reference_prices (product, reference_price, unit) VALUES
  ('Dal (Masoor)',  300.00, 'kg'),
  ('Eggs',          330.00, 'dozen'),
  ('Beef',         1100.00, 'kg'),
  ('Bananas',       180.00, 'dozen'),
  ('Tea',          2200.00, 'kg'),
  ('Roti (Naan)',    25.00, 'piece'),
  ('Petrol',        280.00, 'litre'),
  ('LPG Cylinder', 3200.00, 'cylinder')
ON CONFLICT (product) DO NOTHING;

-- Allow staff to INSERT new reference prices (the original schema only allowed UPDATE).
DROP POLICY IF EXISTS "Staff can insert reference prices" ON reference_prices;
CREATE POLICY "Staff can insert reference prices"
  ON reference_prices FOR INSERT
  WITH CHECK (public.staff_requester_can_update_reference_prices());

GRANT INSERT ON reference_prices TO authenticated;
