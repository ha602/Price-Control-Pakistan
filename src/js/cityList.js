import { CITIES } from './config.js'
import { supabase } from './supabase.js'

/**
 * City names for dropdowns.
 * Always tries DB `cities` table first; falls back to static CITIES from config
 * if the table doesn't exist yet or returns nothing.
 */
export async function getCityNames() {
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('name')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      // Table may not exist yet — fall through to static list
      return [...CITIES]
    }
    const names = (data || []).map((r) => r.name).filter(Boolean)
    return names.length ? names : [...CITIES]
  } catch (e) {
    return [...CITIES]
  }
}
