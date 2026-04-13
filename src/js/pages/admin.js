import '../../css/main.css'
import { renderLayout } from '../layout.js'
import { PRODUCTS } from '../config.js'
import { getReferencePrices, updateReferencePrice, getNationalAverages } from '../api.js'
import { formatPKR, calcOverprice, getSeverityLabel, showToast } from '../utils.js'
import { requireAdminOrRedirect } from '../auth.js'

;(async () => {
  const session = await requireAdminOrRedirect()
  if (!session) return

  const container = await renderLayout('Reference Prices', 'admin', {
    showAdminNav: true,
    userEmail: session.user.email
  })

  container.innerHTML = `
  <div class="page-header">
    <div class="page-header__breadcrumb">Home › Reference Prices</div>
    <h1>Reference Price Management</h1>
    <p>Update official or government-approved reference prices. These are used to detect overpricing.</p>
  </div>

  <div class="grid-2">
    <!-- Left: Edit Table -->
    <div>
      <div class="card card--glow">
        <div class="card__header">
          <div>
            <div class="card__title">⚙️ Current Reference Prices</div>
            <div class="card__subtitle">Click any price to edit it</div>
          </div>
          <button class="btn btn--primary btn--sm" id="save-all-btn">💾 Save All Changes</button>
        </div>

        <div id="ref-table-wrap">
          <div class="loading-overlay"><div class="spinner"></div><span class="loading-text">Loading…</span></div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card__header">
          <div class="card__title">ℹ️ About Reference Prices</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.75rem">
          ${[
            ['📋', 'Reference prices are the official or recommended market prices set by authorities.'],
            ['⚠️', `If a submitted price exceeds the reference by more than 10%, it triggers an alert.`],
            ['🔄', 'Update these regularly to reflect government notifications or seasonal changes.'],
            ['📊', 'These prices are used in all charts and comparison dashboards.']
          ].map(([icon, text]) => `
            <div style="display:flex;gap:0.75rem;align-items:flex-start">
              <span style="font-size:1.2rem;flex-shrink:0">${icon}</span>
              <span style="font-size:0.88rem;color:var(--text-secondary)">${text}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Right: National Averages vs Ref Comparison -->
    <div>
      <div class="card">
        <div class="card__header">
          <div class="card__title">📊 National Avg vs Reference</div>
          <div class="card__subtitle">Based on all submitted data</div>
        </div>
        <div id="national-comparison">
          <div class="loading-overlay"><div class="spinner"></div></div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card__header">
          <div class="card__title">📅 Last Updated</div>
        </div>
        <div id="last-updated-list">
          <div class="loading-overlay"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  </div>
`

// ---- State ----
let refPrices = []
let editedValues = {}
let nationalAvgs = []

// ---- Load ----
async function loadData() {
  try {
    const [refs, nationals] = await Promise.all([
      getReferencePrices(),
      getNationalAverages()
    ])
    refPrices = refs
    nationalAvgs = nationals

    renderRefTable()
    renderNationalComparison()
    renderLastUpdated()
  } catch (err) {
    console.error('Admin load error:', err)
    showToast('Failed to load reference prices', 'error')
  }
}

// ---- Render Reference Price Edit Table ----
function renderRefTable() {
  const el = document.getElementById('ref-table-wrap')

  if (!refPrices.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📭</div>
        <div class="empty-state__title">No reference prices</div>
        <div class="empty-state__msg">Run the SQL setup script to populate reference prices.</div>
      </div>`
    return
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.75rem" id="ref-items">
      ${refPrices.map(r => {
        const product = PRODUCTS.find(p => p.name === r.product)
        const icon = product ? product.icon : '📦'
        const key = r.product.replace(/[^a-z]/gi, '_')
        return `
          <div class="price-item" id="ref-item-${key}" style="display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem">
            <span style="font-size:1.4rem;flex-shrink:0">${icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;color:var(--text-primary);font-size:0.92rem">${r.product}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">per ${r.unit}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">
              <span style="font-size:0.8rem;color:var(--text-muted)">Rs.</span>
              <input
                type="number"
                id="ref-input-${key}"
                data-product="${r.product}"
                data-original="${r.reference_price}"
                value="${r.reference_price}"
                min="1"
                step="0.5"
                style="width:100px;font-family:'JetBrains Mono',monospace;font-size:0.95rem;text-align:right"
              />
              <span id="ref-changed-${key}" class="hidden" style="color:var(--amber);font-size:0.75rem">●</span>
            </div>
          </div>
        `
      }).join('')}
    </div>
    <div id="bulk-save-msg" class="hidden mt-2" style="font-size:0.85rem;color:var(--text-muted);text-align:right">
      Click "Save All Changes" to apply
    </div>
  `

  // Track changes
  document.querySelectorAll('[data-product][data-original]').forEach(input => {
    input.addEventListener('input', () => {
      const key = input.dataset.product.replace(/[^a-z]/gi, '_')
      const changed = input.value !== input.dataset.original
      const dot = document.getElementById(`ref-changed-${key}`)
      if (dot) dot.classList.toggle('hidden', !changed)

      if (changed) {
        editedValues[input.dataset.product] = input.value
        document.getElementById('bulk-save-msg').classList.remove('hidden')
      } else {
        delete editedValues[input.dataset.product]
        if (Object.keys(editedValues).length === 0) {
          document.getElementById('bulk-save-msg').classList.add('hidden')
        }
      }
    })
  })
}

// ---- National Comparison ----
function renderNationalComparison() {
  const el = document.getElementById('national-comparison')

  if (!nationalAvgs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📊</div><div class="empty-state__msg">No submission data yet. Submit some prices to see comparison.</div></div>`
    return
  }

  const refMap = {}
  refPrices.forEach(r => { refMap[r.product] = r.reference_price })

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.5rem">
      ${nationalAvgs.map(a => {
        const ref = refMap[a.product]
        if (!ref) return ''
        const { pct, isOverpriced, severity } = calcOverprice(parseFloat(a.avg_price), ref)
        const barWidth = Math.min(Math.abs(pct) * 2, 100)
        const product = PRODUCTS.find(p => p.name === a.product)
        const icon = product ? product.icon : '📦'

        return `
          <div style="padding:0.75rem;background:var(--bg-raised);border-radius:var(--radius-sm);border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
              <span style="font-size:0.88rem;color:var(--text-primary);font-weight:600">${icon} ${a.product}</span>
              <div style="display:flex;align-items:center;gap:0.5rem">
                <span class="mono" style="font-size:0.82rem;color:var(--text-muted)">${formatPKR(a.avg_price)}</span>
                <span class="badge badge--${severity}" style="font-size:0.72rem">${pct > 0 ? '+' : ''}${pct}%</span>
              </div>
            </div>
            <div style="background:var(--bg-card);border-radius:4px;height:6px;overflow:hidden">
              <div style="height:100%;width:${barWidth}%;background:${isOverpriced ? 'var(--red)' : 'var(--green)'};border-radius:4px;transition:width 0.5s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:0.25rem">
              <span style="font-size:0.7rem;color:var(--text-muted)">${a.submission_count} submissions</span>
              <span style="font-size:0.7rem;color:var(--text-muted)">Ref: ${formatPKR(ref)}</span>
            </div>
          </div>
        `
      }).filter(Boolean).join('')}
    </div>
  `
}

// ---- Last Updated ----
function renderLastUpdated() {
  const el = document.getElementById('last-updated-list')
  if (!refPrices.length) { el.innerHTML = '<p class="text-muted text-sm text-center" style="padding:1rem">No data</p>'; return }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.5rem">
      ${refPrices.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;padding:0.4rem 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-secondary)">${r.product}</span>
          <span style="color:var(--text-muted);font-size:0.78rem">${formatUpdated(r.updated_at)}</span>
        </div>
      `).join('')}
    </div>
  `
}

function formatUpdated(dt) {
  if (!dt) return 'Never'
  return new Date(dt).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })
}

// ---- Save All ----
document.getElementById('save-all-btn').addEventListener('click', async () => {
  const entries = Object.entries(editedValues)
  if (!entries.length) {
    showToast('No changes to save', 'info')
    return
  }

  // Validate all
  for (const [product, val] of entries) {
    if (!val || isNaN(parseFloat(val)) || parseFloat(val) <= 0) {
      showToast(`Invalid price for ${product}`, 'error')
      return
    }
  }

  const btn = document.getElementById('save-all-btn')
  btn.classList.add('btn--loading')
  btn.disabled = true
  btn.textContent = 'Saving…'

  try {
    await Promise.all(entries.map(([product, price]) => updateReferencePrice(product, price)))
    showToast(`✅ ${entries.length} reference price${entries.length > 1 ? 's' : ''} updated!`, 'success')
    editedValues = {}

    // Update originals
    document.querySelectorAll('[data-original]').forEach(input => {
      input.dataset.original = input.value
      const key = input.dataset.product.replace(/[^a-z]/gi, '_')
      const dot = document.getElementById(`ref-changed-${key}`)
      if (dot) dot.classList.add('hidden')
    })
    document.getElementById('bulk-save-msg')?.classList.add('hidden')

    // Reload to reflect
    await loadData()

  } catch (err) {
    console.error('Save error:', err)
    showToast('Failed to save changes. Check Supabase permissions.', 'error')
  } finally {
    btn.classList.remove('btn--loading')
    btn.disabled = false
    btn.textContent = '💾 Save All Changes'
  }
})

  // ---- Init ----
  loadData()
})()
