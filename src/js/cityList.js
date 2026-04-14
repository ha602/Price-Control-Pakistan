import { CITIES } from './config.js'
import { supabase } from './supabase.js'
import { isPhase2 } from './phase.js'

/**
 * City names for dropdowns: Phase 1 uses static config; Phase 2 loads from `cities` table.
 */
export async function getCityNames() {
  if (!isPhase2()) {
    return [...CITIES]
  }
  const { data, error } = await supabase
    .from('cities')
    .select('name')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.warn('[getCityNames]', error.message)
    return [...CITIES]
  }
  const names = (data || []).map((r) => r.name).filter(Boolean)
  return names.length ? names : [...CITIES]
}
