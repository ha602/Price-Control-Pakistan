import '../../css/main.css'
import { renderLayout } from '../layout.js'
import { isPhase2 } from '../phase.js'
import { requirePermission } from '../auth.js'
import { supabase } from '../supabase.js'
import { getAllAverages, getReferencePrices } from '../api.js'
import { buildRefMap, calcOverprice, showToast } from '../utils.js'
import { OVERPRICE_THRESHOLD } from '../config.js'

function esc(s) {
  if (s == null || s === '') return ''
  const div = document.createElement('div')
  div.textContent = String(s)
  return div.innerHTML
}

function countOverpricedForCity(rows, refMap) {
  let n = 0
  ;(rows || []).forEach((a) => {
    const ref = refMap[a.product]
    if (!ref) return
    if (calcOverprice(parseFloat(a.avg_price), ref).isOverpriced) n++
  })
  return n
}

async function loadCitiesWithMonitors() {
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, sort_order, city_monitors(head_name, email, phone, notes)')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

async function countSubmissionsForCity(cityName) {
  const { count, error } = await supabase
    .from('price_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('city', cityName)

  if (error) throw error
  return count || 0
}

;(async () => {
  if (!isPhase2()) {
    window.location.replace('/dashboard.html')
    return
  }

  const ctx = await requirePermission('areaMonitors')
  if (!ctx) return

  const { session, profile } = ctx

  const container = await renderLayout('Area monitors', 'areaMonitors', {
    session,
    profile,
    userEmail: session.user.email
  })

  container.innerHTML = `
  <div class="page-header">
    <div class="page-header__breadcrumb">Home › Area monitors</div>
    <h1>City area heads</h1>
    <p>Assign a head monitor per city, review overpricing vs reference prices, and send SMTP alerts when action is needed.</p>
  </div>

  <div class="card mb-3">
    <div class="card__header">
      <div class="card__title">Add city</div>
      <div class="card__subtitle">Name must match how it appears in submissions (dropdown uses this list in Phase 2).</div>
    </div>
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end">
      <div class="form-group" style="margin:0;flex:1;min-width:200px">
        <label class="form-label" for="new-city-name">City name</label>
        <input type="text" id="new-city-name" placeholder="e.g. Gilgit" maxlength="80" />
      </div>
      <button type="button" class="btn btn--primary" id="add-city-btn">Add city</button>
    </div>
  </div>

  <div class="card">
    <div class="card__header">
      <div>
        <div class="card__title">Monitors & alerts</div>
        <div class="card__subtitle">Overpriced = avg market price more than ${OVERPRICE_THRESHOLD}% above reference (same rule as dashboard).</div>
      </div>
      <button type="button" class="btn btn--outline btn--sm" id="refresh-btn">Refresh</button>
    </div>
    <p class="text-muted" style="padding:0 0 1rem;font-size:0.88rem">Optional note appended to every alert email:</p>
    <div class="form-group" style="margin-bottom:1rem">
      <textarea id="alert-note-template" rows="2" placeholder="Optional message from admin…" style="width:100%;max-width:560px"></textarea>
    </div>
    <div class="table-wrap" id="monitors-table-wrap">
      <div class="loading-overlay"><div class="spinner"></div><span class="loading-text">Loading…</span></div>
    </div>
  </div>
`

  const wrap = document.getElementById('monitors-table-wrap')
  let averagesByCity = /** @type {Record<string, any[]>} */ ({})
  let refMap = /** @type {Record<string, number>} */ ({})

  async function refreshData() {
    const [cities, refData, allAvg] = await Promise.all([
      loadCitiesWithMonitors(),
      getReferencePrices(),
      getAllAverages()
    ])
    refMap = buildRefMap(refData)
    averagesByCity = {}
    ;(allAvg || []).forEach((a) => {
      if (!averagesByCity[a.city]) averagesByCity[a.city] = []
      averagesByCity[a.city].push(a)
    })
    renderTable(cities)
  }

  function renderTable(cities) {
    if (!cities.length) {
      wrap.innerHTML =
        '<p class="text-muted" style="padding:1rem">No cities yet. Add one above (seed migration should have created defaults).</p>'
      return
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>City</th>
            <th>Head name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Notes</th>
            <th>Overpriced</th>
            <th style="min-width:200px">Actions</th>
          </tr>
        </thead>
        <tbody id="monitors-tbody">
          ${cities
            .map((c) => {
              const m = c.city_monitors
              const rows = averagesByCity[c.name] || []
              const nOver = countOverpricedForCity(rows, refMap)
              const head = m?.head_name ?? ''
              const email = m?.email ?? ''
              const phone = m?.phone ?? ''
              const notes = m?.notes ?? ''
              return `
            <tr data-city-id="${c.id}" data-city-name="${encodeURIComponent(c.name)}">
              <td><strong>${esc(c.name)}</strong></td>
              <td><input type="text" id="head-${c.id}" value="${esc(head)}" placeholder="Name" style="min-width:120px;font-size:0.88rem;padding:0.35rem 0.5rem" /></td>
              <td><input type="email" id="email-${c.id}" value="${esc(email)}" placeholder="email@…" style="min-width:160px;font-size:0.88rem;padding:0.35rem 0.5rem" /></td>
              <td><input type="text" id="phone-${c.id}" value="${esc(phone)}" placeholder="Optional" style="font-size:0.88rem;padding:0.35rem 0.5rem" /></td>
              <td><input type="text" id="notes-${c.id}" value="${esc(notes)}" placeholder="Optional" style="min-width:100px;font-size:0.88rem;padding:0.35rem 0.5rem" /></td>
              <td>
                <span class="badge ${nOver > 0 ? 'badge--high' : 'badge--normal'}">${nOver}</span>
              </td>
              <td style="display:flex;flex-wrap:wrap;gap:0.35rem">
                <button type="button" class="btn btn--primary btn--sm" data-act="save">Save</button>
                <button type="button" class="btn btn--outline btn--sm" data-act="alert" ${!email || nOver === 0 ? 'disabled' : ''}>Send alert</button>
                <button type="button" class="btn btn--ghost btn--sm" data-act="delete">Delete city</button>
              </td>
            </tr>`
            })
            .join('')}
        </tbody>
      </table>
    `

    wrap.querySelector('#monitors-tbody')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]')
      if (!btn) return
      const tr = btn.closest('tr[data-city-id]')
      if (!tr) return
      const cityId = tr.dataset.cityId
      const cityName = decodeURIComponent(tr.dataset.cityName || '')
      const act = btn.getAttribute('data-act')

      if (act === 'save') {
        const head_name = document.getElementById(`head-${cityId}`)?.value?.trim() ?? ''
        const email = document.getElementById(`email-${cityId}`)?.value?.trim() ?? ''
        const phone = document.getElementById(`phone-${cityId}`)?.value?.trim() ?? ''
        const notes = document.getElementById(`notes-${cityId}`)?.value?.trim() ?? ''
        if (!email) {
          showToast('Email is required to save a monitor.', 'warning')
          return
        }
        btn.disabled = true
        try {
          const { error } = await supabase.from('city_monitors').upsert(
            {
              city_id: cityId,
              head_name,
              email,
              phone: phone || null,
              notes: notes || null,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'city_id' }
          )
          if (error) throw error
          showToast('Monitor saved.', 'success')
          await refreshData()
        } catch (err) {
          console.error(err)
          showToast(err.message || 'Save failed', 'error')
        } finally {
          btn.disabled = false
        }
        return
      }

      if (act === 'delete') {
        const n = await countSubmissionsForCity(cityName)
        if (n > 0) {
          showToast(`Cannot delete: ${n} submission(s) reference this city. Rename or migrate data in SQL first.`, 'warning')
          return
        }
        if (!confirm(`Delete city “${cityName}” and its monitor row?`)) return
        btn.disabled = true
        try {
          const { error } = await supabase.from('cities').delete().eq('id', cityId)
          if (error) throw error
          showToast('City removed.', 'success')
          await refreshData()
        } catch (err) {
          console.error(err)
          showToast(err.message || 'Delete failed', 'error')
        } finally {
          btn.disabled = false
        }
        return
      }

      if (act === 'alert') {
        const note = document.getElementById('alert-note-template')?.value?.trim() ?? ''
        btn.disabled = true
        try {
          const { data, error } = await supabase.functions.invoke('send-area-alert', {
            body: { cityId, note }
          })
          if (error) throw error
          if (data?.error) throw new Error(data.error)
          showToast('Alert email sent.', 'success')
        } catch (err) {
          console.error(err)
          showToast(err.message || 'Send failed (deploy Edge Function and SMTP secrets)', 'error')
        } finally {
          btn.disabled = false
        }
      }
    })
  }

  document.getElementById('add-city-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('new-city-name')
    const name = input?.value?.trim()
    if (!name) {
      showToast('Enter a city name.', 'warning')
      return
    }
    const btn = document.getElementById('add-city-btn')
    btn.disabled = true
    try {
      const { error } = await supabase.from('cities').insert({
        name,
        sort_order: 999
      })
      if (error) {
        if (error.code === '23505') {
          showToast('That city already exists.', 'warning')
          return
        }
        throw error
      }
      input.value = ''
      showToast('City added.', 'success')
      await refreshData()
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Could not add city', 'error')
    } finally {
      btn.disabled = false
    }
  })

  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    showToast('Refreshing…', 'info')
    try {
      await refreshData()
    } catch (err) {
      console.error(err)
      showToast('Refresh failed', 'error')
    }
  })

  try {
    await refreshData()
  } catch (err) {
    console.error(err)
    wrap.innerHTML = `<p class="text-muted" style="padding:1rem">${esc(err.message)} — run supabase-phase2-area-monitors.sql and set VITE_APP_PHASE=2.</p>`
  }
})()
