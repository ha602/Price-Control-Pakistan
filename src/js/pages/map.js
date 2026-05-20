import '../../css/main.css'
import { renderLayout } from '../layout.js'
import { getAllAverages, getReferencePrices } from '../api.js'
import { buildRefMap, formatPKR, showToast } from '../utils.js'
import { CITY_COORDS } from '../cityCoords.js'
import { t } from '../i18n.js'

// Leaflet is loaded via the CDN <script> we inject below at runtime.
function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L)
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    s.crossOrigin = ''
    s.onload = () => resolve(window.L)
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function colorFor(pct) {
  if (pct == null) return '#94a3b8'   // grey — no data
  if (pct <= 10) return '#22c55e'     // green — within reference
  if (pct <= 25) return '#f59e0b'     // amber — slightly above
  return '#ef4444'                    // red — high
}

;(async () => {
  const container = await renderLayout(t('nav.map'), 'map')

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__breadcrumb">Home › ${t('nav.map')}</div>
      <h1>${t('map.title')}</h1>
      <p>${t('map.subtitle')}</p>
    </div>

    <div class="card">
      <div id="map" class="map-wrap"></div>
      <div class="map-legend">
        <span><span class="map-legend__dot" style="background:#22c55e"></span>${t('map.legendNormal')} (≤10%)</span>
        <span><span class="map-legend__dot" style="background:#f59e0b"></span>${t('map.legendMild')} (10–25%)</span>
        <span><span class="map-legend__dot" style="background:#ef4444"></span>${t('map.legendHigh')} (&gt;25%)</span>
        <span><span class="map-legend__dot" style="background:#94a3b8"></span>${t('map.noData')}</span>
      </div>
    </div>
  `

  let L
  try {
    L = await loadLeaflet()
  } catch (e) {
    showToast('Map library failed to load. Check your connection.', 'error')
    return
  }

  const map = L.map('map', { scrollWheelZoom: false }).setView([30.3753, 69.3451], 5)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 12
  }).addTo(map)

  let refMap = {}, averages = []
  try {
    const [refs, allAvg] = await Promise.all([getReferencePrices(), getAllAverages()])
    refMap = buildRefMap(refs)
    averages = allAvg || []
  } catch (e) {
    console.error(e)
    showToast('Could not load price data.', 'error')
  }

  // Per-city aggregate overpricing
  const byCity = {}
  averages.forEach(a => {
    const ref = refMap[a.product]
    const avg = parseFloat(a.avg_price)
    if (!ref || !avg) return
    const pct = ((avg - ref) / ref) * 100
    if (!byCity[a.city]) byCity[a.city] = { deltas: [], products: [] }
    byCity[a.city].deltas.push(pct)
    byCity[a.city].products.push({ product: a.product, avg, ref, pct })
  })

  Object.keys(CITY_COORDS).forEach(city => {
    const [lat, lng] = CITY_COORDS[city]
    const data = byCity[city]
    const avgPct = data ? data.deltas.reduce((s, d) => s + d, 0) / data.deltas.length : null
    const color = colorFor(avgPct)
    const radius = data ? Math.max(7, Math.min(22, 7 + data.deltas.length * 1.5)) : 6

    const marker = L.circleMarker([lat, lng], {
      radius,
      color: '#0f172a',
      weight: 1,
      fillColor: color,
      fillOpacity: 0.85
    }).addTo(map)

    let popup = `<strong>${city}</strong><br/>`
    if (data) {
      const rounded = Math.round(avgPct * 10) / 10
      popup += `<span>Avg overpricing: <strong>${rounded > 0 ? '+' : ''}${rounded}%</strong></span>`
      popup += `<ul style="margin:6px 0 0;padding-left:18px">`
      data.products
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5)
        .forEach(p => {
          const sign = p.pct > 0 ? '+' : ''
          popup += `<li>${p.product}: ${formatPKR(p.avg)} (${sign}${Math.round(p.pct * 10) / 10}%)</li>`
        })
      popup += `</ul>`
    } else {
      popup += `<em>${t('map.noData')}</em>`
    }
    marker.bindPopup(popup)
  })
})()
