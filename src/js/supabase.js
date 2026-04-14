import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Supabase credentials missing! Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

/**
 * Invoke an Edge Function with a valid user access token.
 * Uses `refreshSession()` first (prefer its returned session — `getSession()` can still expose stale JWTs).
 * Calls the REST URL with explicit `apikey` + `Authorization` so the gateway always gets a matching pair for this project.
 * @param {string} name
 * @param {Record<string, unknown>} body
 */
export async function invokeEdgeFunction(name, body) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!baseUrl || !anonKey) {
    return {
      data: null,
      error: new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    }
  }

  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
  if (refreshErr) {
    console.warn('Session refresh:', refreshErr.message)
  }

  let accessToken = refreshed?.session?.access_token?.trim()
  if (!accessToken) {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    accessToken = session?.access_token?.trim()
  }

  if (!accessToken) {
    return {
      data: null,
      error: Object.assign(new Error('Not signed in or session expired. Please sign in again.'), {
        code: 'NO_SESSION'
      })
    }
  }

  const url = `${baseUrl}/functions/v1/${encodeURIComponent(name)}`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey
      },
      body: JSON.stringify(body)
    })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    return { data: null, error: err }
  }

  const text = await res.text()
  /** @type {Record<string, unknown> | null} */
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { message: text }
    }
  }

  if (!res.ok) {
    const msg =
      (typeof payload?.message === 'string' && payload.message) ||
      (typeof payload?.error === 'string' && payload.error) ||
      res.statusText ||
      'Edge function request failed'
    const err = /** @type {Error & { status?: number; code?: string | number }} */ (
      Object.assign(new Error(msg), {
        status: res.status,
        code: payload?.code
      })
    )
    return { data: null, error: err }
  }

  return { data: payload, error: null }
}
