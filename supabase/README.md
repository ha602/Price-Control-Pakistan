# Supabase admin access

Admins sign in at `/login.html` (sidebar: **Admin sign in**), then use the dashboard and other tools according to `staff_profiles` permissions.

Provision users in **Supabase → Authentication**, then insert or update **`public.staff_profiles`** with that user’s UUID and the right flags (`is_super_admin` and/or `can_view_*`). See comments in `supabase-setup.sql` at the end of the file.

There is no in-app “team” UI; manage accounts from the Supabase dashboard or SQL.
