import { supabase } from './supabase.js'

/** @typedef {'dashboard' | 'history' | 'reference' | 'areaMonitors'} StaffPermissionKey */

let cachedUserId = /** @type {string | null} */ (null)
let cachedProfile = /** @type {Record<string, unknown> | null | undefined} */ (undefined)

export function clearStaffProfileCache() {
  cachedUserId = null
  cachedProfile = undefined
}

/**
 * Current session (may be null).
 */
export async function getSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  return session
}

/**
 * Staff row for the signed-in user (RLS: own row or super admin sees all).
 */
export async function getStaffProfile() {
  const session = await getSession()
  if (!session?.user) return null
  if (cachedUserId === session.user.id && cachedProfile !== undefined) {
    return cachedProfile
  }
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (error) {
    console.warn('Staff profile load failed:', error.message)
    cachedUserId = session.user.id
    cachedProfile = null
    return null
  }
  cachedUserId = session.user.id
  cachedProfile = data
  return data
}

/**
 * Any admin access (login allowed).
 * A row with only user_id and default false flags is NOT treated as admin — set at least one permission or is_super_admin.
 */
export function hasStaffAccess(profile) {
  if (!profile) return false
  if (profile.is_super_admin) return true
  return !!(
    profile.can_view_dashboard ||
    profile.can_view_history ||
    profile.can_manage_reference_prices ||
    profile.can_manage_area_monitors
  )
}

/**
 * Human-readable reason admin login was blocked (after getStaffProfile).
 * @param {Record<string, unknown> | null} profile
 */
export function getStaffLoginBlockerMessage(profile) {
  if (profile === null) {
    return 'No row in staff_profiles for this user, or it could not be loaded. Copy the user UUID from Supabase Authentication → Users into staff_profiles.user_id (same project as this app).'
  }
  if (!hasStaffAccess(profile)) {
    return 'Your staff_profiles row exists but has no permissions yet. In Supabase SQL, set is_super_admin = true or set at least one of: can_view_dashboard, can_view_history, can_manage_reference_prices, can_manage_area_monitors to true.'
  }
  return null
}

/**
 * Feature gate: super admin has full access.
 * @param {Record<string, unknown> | null} profile
 * @param {StaffPermissionKey} key
 */
export function hasPermission(profile, key) {
  if (!profile) return false
  if (profile.is_super_admin) return true
  switch (key) {
    case 'dashboard':
      return !!profile.can_view_dashboard
    case 'history':
      return !!profile.can_view_history
    case 'reference':
      return !!profile.can_manage_reference_prices
    case 'areaMonitors':
      return !!profile.can_manage_area_monitors
    default:
      return false
  }
}

/**
 * Redirects if not signed in, not an authorized admin, or missing permission. Returns session + profile when allowed.
 */
export async function requirePermission(perm, loginPath = '/login.html') {
  const session = await getSession()
  if (!session?.user) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.href = `${loginPath}?next=${next}`
    return null
  }
  const profile = await getStaffProfile()
  if (!hasStaffAccess(profile)) {
    await supabase.auth.signOut()
    clearStaffProfileCache()
    const next = encodeURIComponent(window.location.pathname)
    window.location.href = `${loginPath}?next=${next}&reason=forbidden`
    return null
  }
  if (!hasPermission(profile, perm)) {
    window.location.href = `${loginPath}?reason=nopermission`
    return null
  }
  return { session, profile }
}

export function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  clearStaffProfileCache()
  return supabase.auth.signOut()
}
