# Supabase: Phase 1 and Phase 2

## Phase 1 (default)

Admins sign in at `/login.html`, provision users in **Authentication**, and add rows to **`public.staff_profiles`** (see root `supabase-setup.sql`).

Set `VITE_APP_PHASE=1` in `.env` (or omit it) before `npm run build`. The build injects `window.__APP_PHASE__` into each HTML file.

## Phase 2: Area monitors + SMTP alerts

1. **SQL:** Run [`supabase-phase2-area-monitors.sql`](../supabase-phase2-area-monitors.sql) in the SQL Editor (adds `cities`, `city_monitors`, `can_manage_area_monitors`).

2. **Staff:** Set `can_manage_area_monitors = true` for users who should manage city heads (or rely on `is_super_admin`).

3. **App build:** Set `VITE_APP_PHASE=2` in `.env`, then `npm run build`. Redeploy the static site.

4. **Edge Function `send-area-alert`:** Deploy and set **secrets** (Dashboard → Edge Functions → `send-area-alert` → Secrets, or CLI):

   | Secret | Purpose |
   |--------|---------|
   | `SMTP_HOST` | SMTP server hostname |
   | `SMTP_PORT` | Usually `587` (STARTTLS) or `465` (implicit TLS) |
   | `SMTP_USER` | SMTP username |
   | `SMTP_PASSWORD` | SMTP password |
   | `SMTP_FROM` | From address (must be allowed by your provider) |
   | `SMTP_SECURE` | `true` for port 465, usually `false` for 587 |

   Optional: `OVERPRICE_THRESHOLD` (default `10`) — must match app logic.

   Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` automatically.

5. **Deploy function** (from repo root, with Supabase CLI linked to the project):

   ```bash
   supabase functions deploy send-area-alert --project-ref YOUR_PROJECT_REF
   ```

6. **Cities:** After migration, `cities` is seeded to match `config.js`. Admins can add cities on **Area monitors**; submission dropdowns load from `cities` when Phase 2 is on.

Renaming a city in SQL without updating `price_submissions.city` will break historical joins; prefer adding new cities over renaming.

## Switching Phase 1 / Phase 2

Change `VITE_APP_PHASE` in `.env`, run `npm run build`, and redeploy. The phase value is embedded in each HTML file at build time (`window.__APP_PHASE__`).
