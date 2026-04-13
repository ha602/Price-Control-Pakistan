import { supabase } from './supabase.js'

/**
 * Current session (may be null). Uses getSession() — call after sign-in if you need fresh JWT.
 */
export async function getSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  return session
}

/**
 * Whether this user is listed in admin_users (server-enforced via RLS).
 */
export async function isAdminUser(user) {
  if (!user?.id) return false
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.warn('Admin check failed:', error.message)
    return false
  }
  return !!data
}

/**
 * Redirects to login if not signed in, or not an admin. Returns session only when allowed.
 */
export async function requireAdminOrRedirect(loginPath = '/login.html') {
  const session = await getSession()
  if (!session?.user) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.href = `${loginPath}?next=${next}`
    return null
  }
  const ok = await isAdminUser(session.user)
  if (!ok) {
    await supabase.auth.signOut()
    const next = encodeURIComponent(window.location.pathname)
    window.location.href = `${loginPath}?next=${next}&reason=forbidden`
    return null
  }
  return session
}

export function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function signOut() {
  return supabase.auth.signOut()
}
