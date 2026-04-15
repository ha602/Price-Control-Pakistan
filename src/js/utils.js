import { OVERPRICE_THRESHOLD, PRICE_LIMITS, PRODUCTS } from './config.js'

// ============================================================
// Formatting
// ============================================================

export function formatPKR(amount) {
  if (amount == null || isNaN(amount)) return '—'
  return `Rs. ${parseFloat(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

export function formatDate(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  return d.toLocaleDateString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function formatDateTime(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  return d.toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatTimeAgo(dateString) {
  if (!dateString) return '—'
  const now = new Date()
  const then = new Date(dateString)
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}

// ============================================================
// Overpricing Detection
// ============================================================

/**
 * Calculate overpricing percentage
 * @returns { pct, isOverpriced, severity }
 */
export function calcOverprice(avgPrice, refPrice) {
  if (!avgPrice || !refPrice) return { pct: 0, isOverpriced: false, severity: 'normal' }

  const pct = ((avgPrice - refPrice) / refPrice) * 100

  let severity = 'normal'
  let isOverpriced = false

  if (pct > OVERPRICE_THRESHOLD) {
    isOverpriced = true
    if (pct > 50) severity = 'critical'
    else if (pct > 25) severity = 'high'
    else severity = 'moderate'
  }

  return { pct: Math.round(pct * 10) / 10, isOverpriced, severity }
}

export function getSeverityLabel(severity) {
  const labels = {
    normal:   'Normal',
    moderate: 'Overpriced',
    high:     'High Overpricing',
    critical: 'Critical Overpricing'
  }
  return labels[severity] || 'Unknown'
}

export function getSeverityColor(severity) {
  const colors = {
    normal:   '#22c55e',
    moderate: '#f59e0b',
    high:     '#ef4444',
    critical: '#7f1d1d'
  }
  return colors[severity] || '#6b7280'
}

// ============================================================
// Validation
// ============================================================

export function validatePrice(product, price) {
  const val = parseFloat(price)

  if (!price || price === '') return { valid: false, msg: 'Price is required' }
  if (isNaN(val)) return { valid: false, msg: 'Must be a number' }
  if (val <= 0) return { valid: false, msg: 'Must be greater than 0' }

  const limits = PRICE_LIMITS[product]
  if (limits) {
    if (val < limits.min) return { valid: false, msg: `Too low (min Rs. ${limits.min})` }
    if (val > limits.max) return { valid: false, msg: `Too high (max Rs. ${limits.max})` }
  }

  return { valid: true, msg: '' }
}

export function validateName(name) {
  if (!name || name.trim() === '') return { valid: true, msg: '' } // optional
  if (name.trim().length < 2) return { valid: false, msg: 'Name too short' }
  if (name.trim().length > 50) return { valid: false, msg: 'Name too long' }
  return { valid: true, msg: '' }
}

// ============================================================
// Helpers
// ============================================================

export function getProductIcon(productName) {
  const p = PRODUCTS.find(p => p.name === productName)
  return p ? p.icon : '📦'
}

export function getProductUnit(productName) {
  const p = PRODUCTS.find(p => p.name === productName)
  return p ? p.unit : 'unit'
}

export function groupByCity(averages) {
  const grouped = {}
  averages.forEach(row => {
    if (!grouped[row.city]) grouped[row.city] = []
    grouped[row.city].push(row)
  })
  return grouped
}

export function groupByProduct(averages) {
  const grouped = {}
  averages.forEach(row => {
    if (!grouped[row.product]) grouped[row.product] = []
    grouped[row.product].push(row)
  })
  return grouped
}

export function buildRefMap(refPrices) {
  const map = {}
  refPrices.forEach(r => { map[r.product] = r.reference_price })
  return map
}

/**
 * Group trend data by date and compute daily averages
 */
export function aggregateTrendByDay(trendData) {
  const groups = {}
  trendData.forEach(r => {
    const day = new Date(r.submitted_at).toLocaleDateString('en-CA') // YYYY-MM-DD
    if (!groups[day]) groups[day] = []
    groups[day].push(parseFloat(r.submitted_price))
  })

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => ({
      date,
      avg: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
    }))
}

export function showToast(message, type = 'info') {
  const existing = document.getElementById('toast-container')
  if (!existing) {
    const c = document.createElement('div')
    c.id = 'toast-container'
    document.body.appendChild(c)
  }

  const toast = document.createElement('div')
  toast.className = `toast toast--${type}`
  toast.innerHTML = `
    <span class="toast__icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
    <span class="toast__msg">${message}</span>
  `
  document.getElementById('toast-container').appendChild(toast)

  setTimeout(() => toast.classList.add('toast--show'), 10)
  setTimeout(() => {
    toast.classList.remove('toast--show')
    setTimeout(() => toast.remove(), 400)
  }, 3500)
}
