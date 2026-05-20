import { supabase } from './supabase.js'

// ============================================================
// Price Submissions
// ============================================================

/**
 * Submit multiple product prices for a city
 * @param {string} city
 * @param {Array<{product:string,price:string|number,unit:string}>} prices
 * @param {string} submitterName
 * @param {string} marketName
 * @param {string|null} [photoUrl] optional public URL of an uploaded receipt photo
 */
export async function submitPrices(city, prices, submitterName, marketName, photoUrl = null) {
  const rows = prices.map(({ product, price, unit }) => ({
    city,
    product,
    submitted_price: parseFloat(price),
    unit,
    submitter_name: submitterName || 'Anonymous',
    market_name: marketName || null,
    photo_url: photoUrl || null,
    submitted_at: new Date().toISOString()
  }))

  // No .select(): returning rows requires SELECT on price_submissions, which is admin-only.
  const { error } = await supabase.from('price_submissions').insert(rows)

  if (error) throw error
  return rows.length
}

/**
 * Upload a receipt / price-tag photo to Supabase Storage and return its public URL.
 * Bucket `price-photos` must exist and be public (see supabase-photo-uploads.sql).
 */
export async function uploadPriceReceipt(file) {
  if (!file) return null
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(ext) ? ext : 'jpg'
  const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`

  const { error } = await supabase
    .storage
    .from('price-photos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${safeExt}`
    })

  if (error) throw error

  const { data } = supabase.storage.from('price-photos').getPublicUrl(path)
  return data?.publicUrl || null
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

/**
 * Upsert a reference price by product name (admin). Use this when seeding
 * newly-added products from PRODUCTS config that don't have a DB row yet.
 */
export async function upsertReferencePrice(product, price, unit = 'kg') {
  const { data, error } = await supabase
    .from('reference_prices')
    .upsert(
      {
        product,
        reference_price: parseFloat(price),
        unit,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'product' }
    )
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
