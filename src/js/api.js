import { supabase } from './supabase.js'

// ============================================================
// Price Submissions
// ============================================================

/**
 * Submit multiple product prices for a city
 */
export async function submitPrices(city, prices, submitterName, marketName) {
  const rows = prices.map(({ product, price, unit }) => ({
    city,
    product,
    submitted_price: parseFloat(price),
    unit,
    submitter_name: submitterName || 'Anonymous',
    market_name: marketName || null,
    submitted_at: new Date().toISOString()
  }))

  // No .select(): returning rows requires SELECT on price_submissions, which is admin-only.
  const { error } = await supabase.from('price_submissions').insert(rows)

  if (error) throw error
  return rows.length
}

/**
 * Get all submissions with optional filters
 */
export async function getSubmissions({ city, product, limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('price_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (city) query = query.eq('city', city)
  if (product) query = query.eq('product', product)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

/**
 * Get total submission count
 */
export async function getSubmissionCount() {
  const { count, error } = await supabase
    .from('price_submissions')
    .select('*', { count: 'exact', head: true })

  if (error) throw error
  return count
}

// ============================================================
// Averages & Analytics
// ============================================================

/**
 * Get average prices per product for a city
 */
export async function getCityAverages(city) {
  const { data, error } = await supabase
    .from('city_product_averages')
    .select('*')
    .eq('city', city)

  if (error) throw error
  return data
}

/**
 * Get all city averages (for overview)
 */
export async function getAllAverages() {
  const { data, error } = await supabase
    .from('city_product_averages')
    .select('*')
    .order('city')

  if (error) throw error
  return data
}

/**
 * Get average price for a specific city + product
 */
export async function getAvgPrice(city, product) {
  const { data, error } = await supabase
    .from('price_submissions')
    .select('submitted_price')
    .eq('city', city)
    .eq('product', product)

  if (error) throw error
  if (!data || data.length === 0) return null

  const avg = data.reduce((sum, r) => sum + parseFloat(r.submitted_price), 0) / data.length
  return Math.round(avg * 100) / 100
}

/**
 * Get price trend for a product in a city (last 30 days, grouped by day)
 */
export async function getPriceTrend(city, product) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('price_submissions')
    .select('submitted_price, submitted_at')
    .eq('city', city)
    .eq('product', product)
    .gte('submitted_at', thirtyDaysAgo.toISOString())
    .order('submitted_at', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Get cities with the most submissions
 */
export async function getTopCities(limit = 5) {
  const { data, error } = await supabase
    .from('price_submissions')
    .select('city')

  if (error) throw error

  const counts = {}
  data.forEach(r => { counts[r.city] = (counts[r.city] || 0) + 1 })

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([city, count]) => ({ city, count }))
}

/**
 * Get national averages across all cities
 */
export async function getNationalAverages() {
  const { data, error } = await supabase
    .from('price_submissions')
    .select('product, submitted_price')

  if (error) throw error

  const groups = {}
  data.forEach(r => {
    if (!groups[r.product]) groups[r.product] = []
    groups[r.product].push(parseFloat(r.submitted_price))
  })

  return Object.entries(groups).map(([product, prices]) => ({
    product,
    avg_price: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
    submission_count: prices.length
  }))
}

// ============================================================
// Reference Prices
// ============================================================

/**
 * Get all official reference prices
 */
export async function getReferencePrices() {
  const { data, error } = await supabase
    .from('reference_prices')
    .select('*')
    .order('product')

  if (error) throw error
  return data
}

/**
 * Update a reference price (admin)
 */
export async function updateReferencePrice(product, newPrice) {
  const { data, error } = await supabase
    .from('reference_prices')
    .update({ reference_price: parseFloat(newPrice), updated_at: new Date().toISOString() })
    .eq('product', product)
    .select()

  if (error) throw error
  return data
}

// ============================================================
// Realtime Subscriptions
// ============================================================

/**
 * Subscribe to new price submissions
 */
export function subscribeToSubmissions(callback) {
  return supabase
    .channel('price_submissions_channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'price_submissions' },
      (payload) => callback(payload.new)
    )
    .subscribe()
}

/**
 * Unsubscribe from realtime channel
 */
export function unsubscribe(channel) {
  if (channel) supabase.removeChannel(channel)
}
