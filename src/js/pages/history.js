import '../../css/main.css'
import { renderLayout } from '../layout.js'
import { PRODUCTS } from '../config.js'
import { getCityNames } from '../cityList.js'
import { getSubmissions, getSubmissionCount } from '../api.js'
import { formatPKR, formatDateTime, calcOverprice, getSeverityLabel, showToast } from '../utils.js'
import { getReferencePrices } from '../api.js'
import { requirePermission } from '../auth.js'

;(async () => {
  const ctx = await requirePermission('history')
  if (!ctx) return

  const cityNames = await getCityNames()

  const { session, profile } = ctx

  const container = await renderLayout('Submission History', 'history', {
    session,
    profile,
    userEmail: session.user.email
  })

  container.innerHTML = `
  <div class="page-header">
    <div class="page-header__breadcrumb">Home › History</div>
    <h1>Submission History</h1>
    <p>Browse all price submissions from citizens across Pakistan.</p>
  </div>

  <!-- Filters -->
  <div class="card mb-3">
    <div class="card__header">
      <div class="card__title">🔍 Filter Submissions</div>
      <button class="btn btn--ghost btn--sm" id="clear-filters-btn">Clear Filters</button>
    </div>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end">
      <div class="form-group" style="margin:0;flex:1;min-width:160px">
        <label class="form-label">City</label>
        <select id="filter-city">
          <option value="">All Cities</option>
          ${cityNames.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0;flex:1;min-width:160px">
        <label class="form-label">Product</label>
        <select id="filter-product">
          <option value="">All Products</option>
          ${PRODUCTS.map(p => `<option value="${p.name}">${p.icon} ${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0;flex:1;min-width:140px">
        <label class="form-label">Min Price (Rs.)</label>
        <input type="number" id="filter-min" placeholder="e.g. 50" min="0" />
      </div>
      <div class="form-group" style="margin:0;flex:1;min-width:140px">
        <label class="form-label">Max Price (Rs.)</label>
        <input type="number" id="filter-max" placeholder="e.g. 500" min="0" />
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Status</label>
        <select id="filter-status">
          <option value="">All</option>
          <option value="overpriced">Overpriced Only</option>
          <option value="normal">Normal Only</option>
        </select>
      </div>
      <button class="btn btn--primary" id="apply-filters-btn">Apply Filters</button>
    </div>
  </div>

  <!-- Summary bar -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem">
    <div id="result-summary" style="font-size:0.9rem;color:var(--text-muted)">Loading…</div>
    <div style="display:flex;gap:0.75rem;align-items:center">
      <label style="font-size:0.85rem;color:var(--text-muted)">Sort by:</label>
      <select id="sort-by" style="width:auto;min-width:150px">
        <option value="submitted_at_desc">Newest First</option>
        <option value="submitted_at_asc">Oldest First</option>
        <option value="price_desc">Highest Price</option>
        <option value="price_asc">Lowest Price</option>
      </select>
    </div>
  </div>

  <!-- Table -->
  <div class="card">
    <div class="table-wrap" id="history-table">
      <div class="loading-overlay"><div class="spinner"></div><span class="loading-text">Loading submissions…</span></div>
    </div>

    <!-- Pagination -->
    <div id="pagination" class="hidden" style="display:flex;align-items:center;justify-content:space-between;padding:1rem 0 0;flex-wrap:wrap;gap:0.75rem">
      <div id="page-info" style="font-size:0.85rem;color:var(--text-muted)"></div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn--ghost btn--sm" id="prev-btn">← Prev</button>
        <div id="page-numbers" style="display:flex;gap:0.25rem"></div>
        <button class="btn btn--ghost btn--sm" id="next-btn">Next →</button>
      </div>
    </div>
  </div>
`

// ---- State ----
const PAGE_SIZE = 20
let currentPage = 0
let totalCount = 0
let refMap = {}
let allData = []

let filters = { city: '', product: '', min: '', max: '', status: '' }
let sortBy = 'submitted_at_desc'

// ---- Load Reference Prices ----
async function loadRefs() {
  try {
    const data = await getReferencePrices()
    data.forEach(r => { refMap[r.product] = r.reference_price })
  } catch (e) { console.warn('Could not load ref prices', e) }
}

// ---- Load Data ----
async function loadData(page = 0) {
  currentPage = page
  const offset = page * PAGE_SIZE

  document.getElementById('history-table').innerHTML =
    '<div class="loading-overlay"><div class="spinner"></div><span class="loading-text">Loading…</span></div>'

  try {
    const params = {
      limit: 1000, // fetch more for client-side filter/sort
      offset: 0
    }
    if (filters.city) params.city = filters.city
    if (filters.product) params.product = filters.product

    const { data } = await getSubmissions(params)
    allData = data || []

    // Client-side filtering
    let filtered = allData

    if (filters.min !== '') {
      filtered = filtered.filter(r => parseFloat(r.submitted_price) >= parseFloat(filters.min))
    }
    if (filters.max !== '') {
      filtered = filtered.filter(r => parseFloat(r.submitted_price) <= parseFloat(filters.max))
    }
    if (filters.status === 'overpriced') {
      filtered = filtered.filter(r => {
        const ref = refMap[r.product]
        return ref && calcOverprice(parseFloat(r.submitted_price), ref).isOverpriced
      })
    } else if (filters.status === 'normal') {
      filtered = filtered.filter(r => {
        const ref = refMap[r.product]
        return !ref || !calcOverprice(parseFloat(r.submitted_price), ref).isOverpriced
      })
    }

    // Sort
    filtered = sortData(filtered, sortBy)

    totalCount = filtered.length
    const pageData = filtered.slice(offset, offset + PAGE_SIZE)

    renderTable(pageData)
    renderPagination(filtered.length)

    const summaryEl = document.getElementById('result-summary')
    summaryEl.textContent = `Showing ${pageData.length} of ${totalCount.toLocaleString()} submissions`

  } catch (err) {
    console.error('History load error:', err)
    document.getElementById('history-table').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">Failed to load data</div>
        <div class="empty-state__msg">Could not connect to Supabase. Please check your credentials and try again.</div>
      </div>`
    showToast('Failed to load submissions', 'error')
  }
}

function sortData(data, sort) {
  const sorted = [...data]
  switch (sort) {
    case 'submitted_at_desc': return sorted.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    case 'submitted_at_asc':  return sorted.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))
    case 'price_desc': return sorted.sort((a, b) => parseFloat(b.submitted_price) - parseFloat(a.submitted_price))
    case 'price_asc':  return sorted.sort((a, b) => parseFloat(a.submitted_price) - parseFloat(b.submitted_price))
    default: return sorted
  }
}

// ---- Render Table ----
function renderTable(data) {
  const el = document.getElementById('history-table')

  if (!data.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📭</div>
        <div class="empty-state__title">No submissions found</div>
        <div class="empty-state__msg">Try adjusting your filters or submit some prices first.</div>
      </div>`
    return
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th>City</th>
          <th>Market Price</th>
          <th>Ref Price</th>
          <th>Diff %</th>
          <th>Status</th>
          <th>Market</th>
          <th>Submitted By</th>
          <th>Date & Time</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((row, i) => {
          const ref = refMap[row.product]
          const { pct, isOverpriced, severity } = ref
            ? calcOverprice(parseFloat(row.submitted_price), ref)
            : { pct: 0, isOverpriced: false, severity: 'normal' }
          const emoji = getProductEmoji(row.product)
          const rowNum = currentPage * PAGE_SIZE + i + 1

          return `
            <tr>
              <td class="mono" style="color:var(--text-muted)">${rowNum}</td>
              <td>
                <span style="display:flex;align-items:center;gap:0.4rem">
                  <span>${emoji}</span>
                  <span style="color:var(--text-primary);font-weight:600">${row.product}</span>
                </span>
              </td>
              <td style="color:var(--text-secondary)">📍 ${row.city}</td>
              <td class="mono" style="color:${isOverpriced ? 'var(--red)' : 'var(--text-primary)'}">
                ${formatPKR(row.submitted_price)}
                <span style="font-size:0.72rem;color:var(--text-muted)">/${row.unit}</span>
              </td>
              <td class="mono" style="color:var(--text-muted)">${ref ? formatPKR(ref) : '—'}</td>
              <td class="mono" style="color:${pct > 0 ? 'var(--red)' : pct < 0 ? 'var(--green)' : 'var(--text-muted)'}">
                ${ref ? (pct > 0 ? '+' : '') + pct + '%' : '—'}
              </td>
              <td><span class="badge badge--${severity}">${getSeverityLabel(severity)}</span></td>
              <td style="color:var(--text-muted);font-size:0.82rem">${row.market_name || '—'}</td>
              <td style="color:var(--text-muted);font-size:0.82rem">${row.submitter_name || 'Anonymous'}</td>
              <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${formatDateTime(row.submitted_at)}</td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>
  `
}

// ---- Pagination ----
function renderPagination(total) {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const paginationEl = document.getElementById('pagination')

  if (totalPages <= 1) {
    paginationEl.classList.add('hidden')
    return
  }
  paginationEl.classList.remove('hidden')
  paginationEl.style.display = 'flex'

  document.getElementById('page-info').textContent =
    `Page ${currentPage + 1} of ${totalPages} (${total.toLocaleString()} results)`

  const prevBtn = document.getElementById('prev-btn')
  const nextBtn = document.getElementById('next-btn')
  prevBtn.disabled = currentPage === 0
  nextBtn.disabled = currentPage >= totalPages - 1

  // Page numbers
  const pageNumbers = document.getElementById('page-numbers')
  const pages = getPageRange(currentPage, totalPages)
  pageNumbers.innerHTML = pages.map(p => {
    if (p === '…') return `<span style="padding:0.35rem 0.5rem;color:var(--text-muted)">…</span>`
    return `<button class="btn btn--${p === currentPage ? 'primary' : 'ghost'} btn--sm" data-page="${p}">${p + 1}</button>`
  }).join('')

  pageNumbers.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => loadData(parseInt(btn.dataset.page)))
  })
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (current < 4) return [0, 1, 2, 3, 4, '…', total - 1]
  if (current > total - 5) return [0, '…', total-5, total-4, total-3, total-2, total-1]
  return [0, '…', current-1, current, current+1, '…', total-1]
}

// ---- Events ----
document.getElementById('apply-filters-btn').addEventListener('click', () => {
  filters.city    = document.getElementById('filter-city').value
  filters.product = document.getElementById('filter-product').value
  filters.min     = document.getElementById('filter-min').value
  filters.max     = document.getElementById('filter-max').value
  filters.status  = document.getElementById('filter-status').value
  loadData(0)
})

document.getElementById('clear-filters-btn').addEventListener('click', () => {
  filters = { city: '', product: '', min: '', max: '', status: '' }
  document.getElementById('filter-city').value = ''
  document.getElementById('filter-product').value = ''
  document.getElementById('filter-min').value = ''
  document.getElementById('filter-max').value = ''
  document.getElementById('filter-status').value = ''
  loadData(0)
})

document.getElementById('sort-by').addEventListener('change', (e) => {
  sortBy = e.target.value
  loadData(0)
})

document.getElementById('prev-btn').addEventListener('click', () => {
  if (currentPage > 0) loadData(currentPage - 1)
})
document.getElementById('next-btn').addEventListener('click', () => {
  loadData(currentPage + 1)
})

// Allow pressing Enter in filter inputs
document.querySelectorAll('#filter-city, #filter-product, #filter-min, #filter-max').forEach(el => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('apply-filters-btn').click()
  })
})

function getProductEmoji(name) {
  const map = { 'Sugar':'🍬','Atta (Wheat)':'🌾','Cooking Oil':'🫙','Rice (Basmati)':'🍚','Milk':'🥛','Chicken':'🍗','Tomatoes':'🍅','Onions':'🧅','Potatoes':'🥔','Apples':'🍎' }
  return map[name] || '📦'
}

  // ---- Init ----
  async function init() {
    await loadRefs()
    await loadData(0)
  }

  init()
})()
