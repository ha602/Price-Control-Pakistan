import '../../css/main.css'
import { renderLayout, setRealtimeStatus, updateAlertBadge } from '../layout.js'
import { CITIES, PRODUCTS, OVERPRICE_THRESHOLD } from '../config.js'
import {
  getCityAverages, getReferencePrices, getNationalAverages,
  getSubmissionCount, getPriceTrend, getAllAverages,
  subscribeToSubmissions, unsubscribe, getTopCities
} from '../api.js'
import {
  formatPKR, calcOverprice, getSeverityLabel, getSeverityColor,
  buildRefMap, aggregateTrendByDay, showToast, formatTimeAgo
} from '../utils.js'
import {
  renderAvgVsRefChart, renderOverpriceDonut,
  renderTrendChart, renderCityComparisonChart
} from '../charts.js'
import { requireAdminOrRedirect } from '../auth.js'

;(async () => {
  const session = await requireAdminOrRedirect()
  if (!session) return

  const container = await renderLayout('Dashboard', 'dashboard', {
    showAdminNav: true,
    userEmail: session.user.email
  })

  container.innerHTML = `
  <div class="page-header">
    <div class="page-header__breadcrumb">Home › Dashboard</div>
    <h1>Price Dashboard</h1>
    <p>Real-time market price analysis across Pakistan's cities.</p>
    <div class="page-header__actions">
      <div class="select-group">
        <label for="city-filter">📍 City:</label>
        <select id="city-filter">
          <option value="">All Cities (National)</option>
          ${CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn--outline btn--sm" id="refresh-btn">🔄 Refresh</button>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats-grid" id="stats-grid">
    ${['submissions','cities','overpriced','last-update'].map(id => `
      <div class="stat-card">
        <div class="skeleton" style="height:28px;width:60%;margin-bottom:6px"></div>
        <div class="skeleton" style="height:14px;width:80%"></div>
      </div>
    `).join('')}
  </div>

  <!-- Alert Banner -->
  <div id="alert-banner" class="hidden mb-3"></div>

  <!-- Charts row -->
  <div class="grid-2 mb-3">
    <div class="card">
      <div class="card__header">
        <div>
          <div class="card__title">📊 Average vs Reference Prices</div>
          <div class="card__subtitle" id="chart-city-label">Select a city above</div>
        </div>
      </div>
      <div class="chart-wrap" style="height:300px" id="avg-chart-wrap">
        <div class="loading-overlay"><div class="spinner"></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card__header">
        <div class="card__title">🔴 Overpricing Overview</div>
      </div>
      <div class="chart-wrap" style="height:300px" id="donut-wrap">
        <div class="loading-overlay"><div class="spinner"></div></div>
      </div>
    </div>
  </div>

  <!-- Alerts section -->
  <div class="card mb-3">
    <div class="card__header">
      <div>
        <div class="card__title">⚠️ Price Alerts</div>
        <div class="card__subtitle">Products priced more than ${OVERPRICE_THRESHOLD}% above reference</div>
      </div>
      <span id="alert-count" class="badge badge--high">—</span>
    </div>
    <div id="alerts-list">
      <div class="loading-overlay"><div class="spinner"></div></div>
    </div>
  </div>

  <!-- Trend & City Comparison -->
  <div class="grid-2 mb-3">
    <div class="card">
      <div class="card__header">
        <div class="card__title">📈 Price Trend (30 days)</div>
      </div>
      <div class="select-group mb-2" style="gap:0.5rem">
        <select id="trend-product">
          ${PRODUCTS.map(p => `<option value="${p.name}">${p.icon} ${p.name}</option>`).join('')}
        </select>
        <select id="trend-city">
          <option value="">Select city…</option>
          ${CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="chart-wrap" style="height:240px">
        <canvas id="trend-chart"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card__header">
        <div class="card__title">🏙 City Comparison</div>
      </div>
      <div class="select-group mb-2">
        <select id="compare-product">
          ${PRODUCTS.map(p => `<option value="${p.name}">${p.icon} ${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="chart-wrap" style="height:240px">
        <canvas id="compare-chart"></canvas>
      </div>
    </div>
  </div>

  <!-- Product breakdown table -->
  <div class="card">
    <div class="card__header">
      <div class="card__title">📋 Product Price Breakdown</div>
      <span id="breakdown-city-label" class="badge badge--info">National</span>
    </div>
    <div class="table-wrap" id="breakdown-table">
      <div class="loading-overlay"><div class="spinner"></div></div>
    </div>
  </div>
`

// ---- State ----
let selectedCity = ''
let allAverages = []
let refMap = {}
let realtimeSub = null

// ---- Loaders ----
async function loadAll() {
  try {
    const [refData, avgData, countData, topCities] = await Promise.all([
      getReferencePrices(),
      getAllAverages(),
      getSubmissionCount(),
      getTopCities(1)
    ])

    refMap = buildRefMap(refData)
    allAverages = avgData || []

    renderStats(countData, allAverages, topCities)
    renderCharts()
    renderAlerts()
    renderBreakdown()

    // Auto-load trend for first city that has data
    const citiesWithData = [...new Set(allAverages.map(a => a.city))]
    if (citiesWithData.length > 0) {
      document.getElementById('trend-city').value = citiesWithData[0]
      loadTrend()
    }
    loadCityComparison()

  } catch (err) {
    console.error('Dashboard load error:', err)
    showToast('Failed to load dashboard data. Check Supabase connection.', 'error')
    setRealtimeStatus(false)
  }
}

async function loadCityData(city) {
  try {
    const data = await getCityAverages(city)
    // Merge into allAverages
    const otherCities = allAverages.filter(a => a.city !== city)
    allAverages = [...otherCities, ...(data || [])]
    renderCharts()
    renderAlerts()
    renderBreakdown()
  } catch (err) {
    showToast('Failed to load city data', 'error')
  }
}

// ---- Stats ----
function renderStats(totalCount, averages, topCities) {
  const citiesCount = new Set(averages.map(a => a.city)).size

  // Count overpriced items
  let overpricedCount = 0
  averages.forEach(a => {
    const ref = refMap[a.product]
    if (ref) {
      const { isOverpriced } = calcOverprice(parseFloat(a.avg_price), ref)
      if (isOverpriced) overpricedCount++
    }
  })

  const lastUpdate = averages.reduce((latest, a) => {
    return a.last_updated > latest ? a.last_updated : latest
  }, '')

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-card__icon">📝</div>
      <div class="stat-card__value">${(totalCount || 0).toLocaleString()}</div>
      <div class="stat-card__label">Total Submissions</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__icon">🏙</div>
      <div class="stat-card__value">${citiesCount}</div>
      <div class="stat-card__label">Cities Reporting</div>
    </div>
    <div class="stat-card" style="border-top-color:${overpricedCount > 0 ? 'var(--red)' : 'var(--green)'}">
      <div class="stat-card__icon">${overpricedCount > 0 ? '⚠️' : '✅'}</div>
      <div class="stat-card__value" style="color:${overpricedCount > 0 ? 'var(--red)' : 'var(--green)'}">${overpricedCount}</div>
      <div class="stat-card__label">Overpriced Items</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__icon">🕐</div>
      <div class="stat-card__value" style="font-size:1.2rem">${lastUpdate ? formatTimeAgo(lastUpdate) : '—'}</div>
      <div class="stat-card__label">Last Updated</div>
    </div>
  `

  updateAlertBadge(overpricedCount)
}

// ---- Charts ----
function getFilteredAverages() {
  if (!selectedCity) return allAverages
  return allAverages.filter(a => a.city === selectedCity)
}

function renderCharts() {
  const filtered = getFilteredAverages()
  const label = selectedCity || 'All Cities'
  document.getElementById('chart-city-label').textContent = label
  document.getElementById('breakdown-city-label').textContent = selectedCity || 'National Average'

  // Aggregate by product
  const byProduct = {}
  filtered.forEach(a => {
    if (!byProduct[a.product]) byProduct[a.product] = { prices: [], count: 0, last: a.last_updated }
    byProduct[a.product].prices.push(parseFloat(a.avg_price))
    byProduct[a.product].count += parseInt(a.submission_count)
  })

  const aggregated = PRODUCTS
    .map(p => {
      const d = byProduct[p.name]
      if (!d) return null
      return {
        product: p.name,
        avg_price: d.prices.reduce((a, b) => a + b, 0) / d.prices.length,
        submission_count: d.count
      }
    })
    .filter(Boolean)

  if (aggregated.length === 0) {
    document.getElementById('avg-chart-wrap').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📊</div>
        <div class="empty-state__title">No data yet</div>
        <div class="empty-state__msg">No price submissions found${selectedCity ? ` for ${selectedCity}` : ''}.</div>
      </div>`
    document.getElementById('donut-wrap').innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔴</div><div class="empty-state__msg">No data</div></div>`
    return
  }

  // Avg vs Ref chart
  document.getElementById('avg-chart-wrap').innerHTML = '<canvas id="avg-chart"></canvas>'
  renderAvgVsRefChart('avg-chart', aggregated, refMap)

  // Donut
  let overpriced = 0, normal = 0
  aggregated.forEach(a => {
    const ref = refMap[a.product]
    if (ref) {
      calcOverprice(a.avg_price, ref).isOverpriced ? overpriced++ : normal++
    }
  })
  document.getElementById('donut-wrap').innerHTML = '<canvas id="donut-chart"></canvas>'
  renderOverpriceDonut('donut-chart', overpriced, normal)
}

// ---- Alerts ----
function renderAlerts() {
  const filtered = getFilteredAverages()
  const alerts = []

  const byProductCity = {}
  filtered.forEach(a => {
    const key = `${a.city}||${a.product}`
    if (!byProductCity[key]) byProductCity[key] = []
    byProductCity[key].push(a)
  })

  Object.entries(byProductCity).forEach(([key, rows]) => {
    const [city, product] = key.split('||')
    const avgPrice = rows.reduce((s, r) => s + parseFloat(r.avg_price), 0) / rows.length
    const ref = refMap[product]
    if (!ref) return
    const { isOverpriced, pct, severity } = calcOverprice(avgPrice, ref)
    if (isOverpriced) {
      alerts.push({ city, product, avgPrice, refPrice: ref, pct, severity })
    }
  })

  alerts.sort((a, b) => b.pct - a.pct)

  const countEl = document.getElementById('alert-count')
  countEl.textContent = alerts.length
  countEl.className = `badge badge--${alerts.length > 0 ? 'high' : 'normal'}`

  const el = document.getElementById('alerts-list')

  if (alerts.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">✅</div>
        <div class="empty-state__title">No overpricing detected</div>
        <div class="empty-state__msg">All reported prices are within ${OVERPRICE_THRESHOLD}% of reference prices.</div>
      </div>`
    return
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.75rem">
      ${alerts.map(a => {
        const icon = a.severity === 'critical' ? '🔴' : a.severity === 'high' ? '🟠' : '🟡'
        const emoji = getProductEmoji(a.product)
        return `
          <div class="alert-card alert-card--${a.severity}">
            <span class="alert-card__icon">${icon}</span>
            <div class="alert-card__body">
              <div class="alert-card__product">${emoji} ${a.product}</div>
              <div class="alert-card__city">📍 ${a.city}</div>
              <div class="alert-card__prices">
                <div class="alert-card__price-item">
                  <label>Market Price</label>
                  <span style="color:var(--red)">${formatPKR(a.avgPrice)}</span>
                </div>
                <div class="alert-card__price-item">
                  <label>Reference Price</label>
                  <span style="color:var(--green)">${formatPKR(a.refPrice)}</span>
                </div>
              </div>
            </div>
            <div class="alert-card__pct">
              <div class="pct-badge" style="color:${getSeverityColor(a.severity)}">+${a.pct}%</div>
              <div style="margin-top:0.3rem"><span class="badge badge--${a.severity}">${getSeverityLabel(a.severity)}</span></div>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

// ---- Breakdown Table ----
function renderBreakdown() {
  const filtered = getFilteredAverages()
  const el = document.getElementById('breakdown-table')

  const byProduct = {}
  filtered.forEach(a => {
    if (!byProduct[a.product]) byProduct[a.product] = { prices: [], count: 0 }
    byProduct[a.product].prices.push(parseFloat(a.avg_price))
    byProduct[a.product].count += parseInt(a.submission_count)
  })

  const rows = PRODUCTS.map(p => {
    const d = byProduct[p.name]
    if (!d) return null
    const avg = d.prices.reduce((a, b) => a + b, 0) / d.prices.length
    const ref = refMap[p.name]
    const { pct, isOverpriced, severity } = calcOverprice(avg, ref)
    return { product: p.name, icon: p.icon, unit: p.unit, avg, ref, pct, isOverpriced, severity, count: d.count }
  }).filter(Boolean)

  if (!rows.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📋</div><div class="empty-state__msg">No data available</div></div>`
    return
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Avg Market Price</th>
          <th>Reference Price</th>
          <th>Difference</th>
          <th>Status</th>
          <th>Submissions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>
              <span style="display:flex;align-items:center;gap:0.5rem">
                <span style="font-size:1.1rem">${r.icon}</span>
                <span style="color:var(--text-primary);font-weight:600">${r.product}</span>
                <span style="color:var(--text-muted);font-size:0.78rem">/${r.unit}</span>
              </span>
            </td>
            <td class="mono" style="color:${r.isOverpriced ? 'var(--red)' : 'var(--text-primary)'}">${formatPKR(r.avg)}</td>
            <td class="mono">${r.ref ? formatPKR(r.ref) : '—'}</td>
            <td class="mono" style="color:${r.pct > 0 ? 'var(--red)' : r.pct < 0 ? 'var(--green)' : 'var(--text-muted)'}">
              ${r.ref ? (r.pct > 0 ? '+' : '') + r.pct + '%' : '—'}
            </td>
            <td><span class="badge badge--${r.severity}">${getSeverityLabel(r.severity)}</span></td>
            <td class="mono" style="color:var(--text-muted)">${r.count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

// ---- Trend Chart ----
async function loadTrend() {
  const product = document.getElementById('trend-product').value
  const city = document.getElementById('trend-city').value
  if (!city) return

  try {
    const data = await getPriceTrend(city, product)
    const aggregated = aggregateTrendByDay(data)
    const ref = refMap[product] || 0
    renderTrendChart('trend-chart', aggregated, product, ref)
  } catch (err) {
    console.error('Trend error:', err)
  }
}

// ---- City Comparison ----
async function loadCityComparison() {
  const product = document.getElementById('compare-product').value
  const cityData = allAverages.filter(a => a.product === product)
  const ref = refMap[product] || 0

  if (!cityData.length) {
    document.getElementById('compare-chart').parentElement.innerHTML =
      '<div class="chart-empty">No city data for this product yet.</div>'
    return
  }

  renderCityComparisonChart('compare-chart', cityData, ref)
}

// ---- Events ----
document.getElementById('city-filter').addEventListener('change', async (e) => {
  selectedCity = e.target.value
  if (selectedCity) {
    await loadCityData(selectedCity)
  } else {
    renderCharts()
    renderAlerts()
    renderBreakdown()
  }
})

document.getElementById('refresh-btn').addEventListener('click', () => {
  showToast('Refreshing data…', 'info')
  loadAll()
})

document.getElementById('trend-product').addEventListener('change', loadTrend)
document.getElementById('trend-city').addEventListener('change', loadTrend)
document.getElementById('compare-product').addEventListener('change', loadCityComparison)

// ---- Realtime ----
function startRealtime() {
  realtimeSub = subscribeToSubmissions(async () => {
    setRealtimeStatus(true)
    showToast('New price submitted! Refreshing…', 'info')
    await loadAll()
  })
  setRealtimeStatus(true)
}

function getProductEmoji(name) {
  const map = { 'Sugar':'🍬','Atta (Wheat)':'🌾','Cooking Oil':'🫙','Rice (Basmati)':'🍚','Milk':'🥛','Chicken':'🍗','Tomatoes':'🍅','Onions':'🧅','Potatoes':'🥔','Apples':'🍎' }
  return map[name] || '📦'
}

  // ---- Init ----
  loadAll()
  startRealtime()
  window.addEventListener('beforeunload', () => unsubscribe(realtimeSub))
})()
