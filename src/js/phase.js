/**
 * Phase: `1` = static cities from config (default), `2` = DB cities + area monitors + SMTP alerts.
 * Set `VITE_APP_PHASE=2` in `.env` before `npm run build` (Vite injects `window.__APP_PHASE__` into each HTML).
 */
export function isPhase2() {
  if (typeof window === 'undefined') return false
  return String(window.__APP_PHASE__ ?? '') === '2'
}
