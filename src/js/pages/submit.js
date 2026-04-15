import '../../css/main.css'
import { renderLayout } from '../layout.js'
import { CITIES, PRODUCTS } from '../config.js'
import { submitPrices, getReferencePrices } from '../api.js'
import { validatePrice, validateName, formatPKR, showToast } from '../utils.js'

// ---- Render Page ----
;(async () => {
  const container = await renderLayout('Submit Prices', 'submit')

  container.innerHTML = `
  <div class="page-header">
    <div class="page-header__breadcrumb">Home › Submit Prices</div>
    <h1>Report Market Prices</h1>
    <p>Help your community stay informed. Enter the prices you observed at your local market.</p>
  </div>

  <div class="grid-2">
    <!-- Left: Form -->
    <div>
      <div class="card card--glow">
        <div class="card__header">
          <div>
            <div class="card__title">📍 Your Location</div>
            <div class="card__subtitle">Select your city and provide optional details</div>
          </div>
        </div>

        <div id="location-section">
          <div class="form-group" id="city-group">
            <label class="form-label" for="city-select">City <span>*</span></label>
            <select id="city-select">
              <option value="">— Select your city —</option>
              ${CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <div class="form-error" id="city-error">Please select a city</div>
          </div>

          <div class="form-group" id="name-group">
            <label class="form-label" for="submitter-name">Your Name <span style="color:var(--text-muted)">(optional)</span></label>
            <input type="text" id="submitter-name" placeholder="e.g. Ahmed Khan" maxlength="50" />
            <div class="form-error" id="name-error"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="market-name">Market / Shop Name <span style="color:var(--text-muted)">(optional)</span></label>
            <input type="text" id="market-name" placeholder="e.g. Sunday Bazaar, Ravi Market" maxlength="80" />
          </div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card__header">
          <div>
            <div class="card__title">📌 How It Works</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.75rem">
          ${[
            ['1', 'Select your city and market details above'],
            ['2', 'Enter prices for the products you observed'],
            ['3', 'Leave blank any items you didn\'t check'],
            ['4', 'Hit Submit — your data helps the community!']
          ].map(([n, t]) => `
            <div style="display:flex;gap:0.75rem;align-items:flex-start">
              <span style="width:24px;height:24px;border-radius:50%;background:var(--gold-dim);color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0">${n}</span>
              <span style="font-size:0.9rem;color:var(--text-secondary);padding-top:2px">${t}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Right: Price Inputs -->
    <div>
      <div class="card">
        <div class="card__header">
          <div>
            <div class="card__title">🛒 Enter Prices (PKR)</div>
            <div class="card__subtitle">Leave blank to skip an item</div>
          </div>
          <span id="ref-loading" class="text-muted text-sm">Loading reference prices…</span>
        </div>

        <div class="price-grid" id="price-grid">
          ${PRODUCTS.map(p => `
            <div class="price-item" id="item-${p.name.replace(/[^a-z]/gi,'_')}">
              <div class="price-item__header">
                <span class="price-item__icon">${p.icon}</span>
                <div>
                  <div class="price-item__name">${p.name}</div>
                  <div class="price-item__unit">per ${p.unit}</div>
                </div>
              </div>
              <div class="price-item__input-wrap">
                <span class="price-item__prefix">Rs.</span>
                <input
                  type="number"
                  id="price-${p.name.replace(/[^a-z]/gi,'_')}"
                  data-product="${p.name}"
                  data-unit="${p.unit}"
                  placeholder="0.00"
                  min="0"
                  step="0.5"
                />
              </div>
              <div class="price-item__error" id="err-${p.name.replace(/[^a-z]/gi,'_')}"></div>
              <div class="price-item__ref" id="ref-${p.name.replace(/[^a-z]/gi,'_')}">
                <span class="skeleton" style="height:12px;width:80px;display:inline-block"></span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="divider"></div>

        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
          <div id="form-summary" style="font-size:0.9rem;color:var(--text-muted)">
            Fill in at least one price to submit
          </div>
          <div style="display:flex;gap:0.75rem">
            <button class="btn btn--ghost" id="clear-btn">Clear All</button>
            <button class="btn btn--primary btn--lg" id="submit-btn">
              Submit Prices
            </button>
          </div>
        </div>

        <div id="submit-result" class="hidden mt-2"></div>
      </div>
    </div>
  </div>
`

  // ---- State ----
  let refPrices = {}

// ---- Load Reference Prices ----
async function loadRefPrices() {
  try {
    const data = await getReferencePrices()
    data.forEach(r => { refPrices[r.product] = r.reference_price })
    document.getElementById('ref-loading').textContent = ''

    PRODUCTS.forEach(p => {
      const key = p.name.replace(/[^a-z]/gi, '_')
      const el = document.getElementById(`ref-${key}`)
      if (el) {
        const ref = refPrices[p.name]
        el.innerHTML = ref
          ? `Ref price: <span class="text-gold mono">${formatPKR(ref)}</span>`
          : '<span class="text-muted">No reference</span>'
      }
    })
  } catch (err) {
    document.getElementById('ref-loading').textContent = 'Could not load reference prices'
    console.error(err)
  }
}

// ---- Price Input Validation (live) ----
function getFilledPrices() {
  const prices = []
  PRODUCTS.forEach(p => {
    const key = p.name.replace(/[^a-z]/gi, '_')
    const input = document.getElementById(`price-${key}`)
    if (input && input.value.trim() !== '') {
      prices.push({ product: p.name, price: input.value.trim(), unit: p.unit })
    }
  })
  return prices
}

function updateSummary() {
  const filled = getFilledPrices()
  const summaryEl = document.getElementById('form-summary')
  summaryEl.textContent = filled.length > 0
    ? `${filled.length} product${filled.length > 1 ? 's' : ''} ready to submit`
    : 'Fill in at least one price to submit'
  summaryEl.style.color = filled.length > 0 ? 'var(--gold)' : 'var(--text-muted)'
}

document.querySelectorAll('[data-product]').forEach(input => {
  input.addEventListener('input', () => {
    const product = input.dataset.product
    const key = product.replace(/[^a-z]/gi, '_')
    const errEl = document.getElementById(`err-${key}`)
    const itemEl = document.getElementById(`item-${key}`)

    if (input.value.trim() === '') {
      errEl.textContent = ''
      itemEl.classList.remove('has-error')
    } else {
      const { valid, msg } = validatePrice(product, input.value)
      errEl.textContent = valid ? '' : msg
      itemEl.classList.toggle('has-error', !valid)
    }
    updateSummary()
  })
})

// ---- Clear Button ----
document.getElementById('clear-btn').addEventListener('click', () => {
  document.querySelectorAll('[data-product]').forEach(input => {
    input.value = ''
    const key = input.dataset.product.replace(/[^a-z]/gi, '_')
    document.getElementById(`err-${key}`).textContent = ''
    document.getElementById(`item-${key}`).classList.remove('has-error')
  })
  updateSummary()
})

// ---- Submit ----
document.getElementById('submit-btn').addEventListener('click', async () => {
  const city = document.getElementById('city-select').value
  const name = document.getElementById('submitter-name').value
  const market = document.getElementById('market-name').value

  // Validate city
  if (!city) {
    document.getElementById('city-group').classList.add('has-error')
    document.getElementById('city-error').style.display = 'block'
    document.getElementById('city-select').focus()
    showToast('Please select a city first', 'warning')
    return
  }
  document.getElementById('city-group').classList.remove('has-error')
  document.getElementById('city-error').style.display = 'none'

  // Validate name
  const nameCheck = validateName(name)
  if (!nameCheck.valid) {
    document.getElementById('name-group').classList.add('has-error')
    document.getElementById('name-error').textContent = nameCheck.msg
    document.getElementById('name-error').style.display = 'block'
    return
  }
  document.getElementById('name-group').classList.remove('has-error')
  document.getElementById('name-error').style.display = 'none'

  // Validate prices
  const filled = getFilledPrices()
  if (filled.length === 0) {
    showToast('Please enter at least one price', 'warning')
    return
  }

  let hasErrors = false
  filled.forEach(({ product, price }) => {
    const key = product.replace(/[^a-z]/gi, '_')
    const { valid, msg } = validatePrice(product, price)
    if (!valid) {
      document.getElementById(`err-${key}`).textContent = msg
      document.getElementById(`item-${key}`).classList.add('has-error')
      hasErrors = true
    }
  })
  if (hasErrors) {
    showToast('Please fix the highlighted errors', 'error')
    return
  }

  // Submit
  const btn = document.getElementById('submit-btn')
  btn.classList.add('btn--loading')
  btn.disabled = true
  btn.textContent = 'Submitting…'

  try {
    await submitPrices(city, filled, name, market)
    showToast(`✅ ${filled.length} price${filled.length > 1 ? 's' : ''} submitted for ${city}!`, 'success')

    // Clear form
    document.getElementById('clear-btn').click()
    document.getElementById('city-select').value = ''
    document.getElementById('submitter-name').value = ''
    document.getElementById('market-name').value = ''
    updateSummary()

    // Show success message
    const resultEl = document.getElementById('submit-result')
    resultEl.className = 'mt-2'
    resultEl.innerHTML = `
      <div style="background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:var(--radius-md);padding:1rem 1.25rem;display:flex;gap:0.75rem;align-items:center">
        <span style="font-size:1.5rem">✅</span>
        <div>
          <strong style="color:var(--green)">Submitted successfully!</strong>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-top:0.2rem">
            ${filled.length} price${filled.length > 1 ? 's' : ''} reported for <strong style="color:var(--text-primary)">${city}</strong>. Thank you for contributing!
          </div>
        </div>
      </div>
    `
    setTimeout(() => { resultEl.innerHTML = ''; resultEl.className = 'hidden' }, 8000)

  } catch (err) {
    console.error('Submit error:', err)
    showToast('Submission failed. Please check your connection and try again.', 'error')
  } finally {
    btn.classList.remove('btn--loading')
    btn.disabled = false
    btn.textContent = 'Submit Prices'
  }
})

// ---- Init ----
  loadRefPrices()
})()
