import '../../css/main.css'
import { renderLayout } from '../layout.js'
import { supabase } from '../supabase.js'
import { requirePermission } from '../auth.js'
import { showToast } from '../utils.js'

function esc(s) {
  if (s == null) return ''
  const div = document.createElement('div')
  div.textContent = String(s)
  return div.innerHTML
}

async function loadCities() {
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, sort_order, created_at')
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
  const ctx = await requirePermission('areaMonitors')
  if (!ctx) return

  const { session, profile } = ctx

  const container = await renderLayout('Cities', 'cities', {
    session,
    profile,
    userEmail: session.user.email
  })

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__breadcrumb">Home › Cities</div>
      <h1>City Management</h1>
      <p>Add, rename, or reorder the cities citizens can submit prices for. Order is reflected in dropdowns and dashboards.</p>
    </div>

    <div class="card mb-3">
      <div class="card__header">
        <div>
          <div class="card__title">➕ Add a new city</div>
          <div class="card__subtitle">Name must match how it appears in submissions (case-sensitive).</div>
        </div>
      </div>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end">
        <div class="form-group" style="margin:0;flex:1;min-width:220px">
          <label class="form-label" for="new-city-name">City name</label>
          <input type="text" id="new-city-name" placeholder="e.g. Gilgit" maxlength="80" />
        </div>
        <div class="form-group" style="margin:0;width:140px">
          <label class="form-label" for="new-city-sort">Sort order</label>
          <input type="number" id="new-city-sort" placeholder="999" min="0" step="1" />
        </div>
        <button type="button" class="btn btn--primary" id="add-city-btn">Add city</button>
      </div>
    </div>

    <div class="card">
      <div class="card__header">
        <div>
          <div class="card__title">🏙️ All cities</div>
          <div class="card__subtitle">Lower sort numbers appear first. Cities with submissions cannot be deleted.</div>
        </div>
        <button type="button" class="btn btn--outline btn--sm" id="refresh-btn">Refresh</button>
      </div>
      <div class="table-wrap" id="cities-table-wrap">
        <div class="loading-overlay"><div class="spinner"></div><span class="loading-text">Loading…</span></div>
      </div>
    </div>
  `

  const wrap = document.getElementById('cities-table-wrap')

  async function refresh() {
    try {
      const cities = await loadCities()
      renderTable(cities)
    } catch (err) {
      console.error(err)
      wrap.innerHTML = `<p class="text-muted" style="padding:1rem">${esc(err.message)} — make sure the cities table exists (run supabase-phase2-area-monitors.sql).</p>`
    }
  }

  function renderTable(cities) {
    if (!cities.length) {
      wrap.innerHTML = '<p class="text-muted" style="padding:1rem">No cities yet. Add one above.</p>'
      return
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th style="width:80px">Order</th>
            <th>Name</th>
            <th>Added</th>
            <th style="min-width:220px">Actions</th>
          </tr>
        </thead>
        <tbody id="cities-tbody">
          ${cities.map(c => `
            <tr data-id="${c.id}" data-name="${encodeURIComponent(c.name)}">
              <td>
                <input type="number" class="city-row-sort" value="${c.sort_order ?? 0}" min="0" step="1"
                  style="width:70px;font-family:'JetBrains Mono',monospace;font-size:0.88rem;padding:0.35rem 0.5rem;text-align:right" />
              </td>
              <td>
                <input type="text" class="city-row-name" value="${esc(c.name)}" maxlength="80"
                  style="min-width:180px;font-size:0.9rem;padding:0.35rem 0.5rem" />
              </td>
              <td><span class="text-muted text-sm">${c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</span></td>
              <td style="display:flex;flex-wrap:wrap;gap:0.35rem">
                <button type="button" class="btn btn--primary btn--sm" data-act="save">Save</button>
                <button type="button" class="btn btn--ghost btn--sm" data-act="delete">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `

    wrap.querySelector('#cities-tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]')
      if (!btn) return
      const tr = btn.closest('tr[data-id]')
      if (!tr) return
      const id = tr.dataset.id
      const oldName = decodeURIComponent(tr.dataset.name || '')
      const act = btn.getAttribute('data-act')

      if (act === 'save') {
        const name = tr.querySelector('.city-row-name')?.value?.trim()
        const sortRaw = tr.querySelector('.city-row-sort')?.value
        const sort_order = sortRaw === '' || sortRaw == null ? 0 : parseInt(sortRaw, 10)
        if (!name) {
          showToast('Name cannot be empty.', 'warning')
          return
        }
        btn.disabled = true
        try {
          // If name changed, also rewrite price_submissions.city to keep references consistent
          if (name !== oldName) {
            const count = await countSubmissionsForCity(oldName)
            if (count > 0) {
              const ok = confirm(`Rename will also update ${count} existing submission(s) for "${oldName}" → "${name}". Continue?`)
              if (!ok) { btn.disabled = false; return }
              const { error: subErr } = await supabase
                .from('price_submissions')
                .update({ city: name })
                .eq('city', oldName)
              if (subErr) throw subErr
            }
          }

          const { error } = await supabase
            .from('cities')
            .update({ name, sort_order })
            .eq('id', id)
          if (error) throw error
          showToast('City saved.', 'success')
          await refresh()
        } catch (err) {
          console.error(err)
          showToast(err.message || 'Save failed', 'error')
        } finally {
          btn.disabled = false
        }
        return
      }

      if (act === 'delete') {
        const count = await countSubmissionsForCity(oldName)
        if (count > 0) {
          showToast(`Cannot delete: ${count} submission(s) reference "${oldName}". Rename first or migrate data.`, 'warning')
          return
        }
        if (!confirm(`Delete city “${oldName}”?`)) return
        btn.disabled = true
        try {
          const { error } = await supabase.from('cities').delete().eq('id', id)
          if (error) throw error
          showToast('City removed.', 'success')
          await refresh()
        } catch (err) {
          console.error(err)
          showToast(err.message || 'Delete failed', 'error')
        } finally {
          btn.disabled = false
        }
      }
    })
  }

  document.getElementById('add-city-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-city-name')
    const sortInput = document.getElementById('new-city-sort')
    const name = nameInput?.value?.trim()
    const sortRaw = sortInput?.value
    const sort_order = sortRaw === '' || sortRaw == null ? 999 : parseInt(sortRaw, 10)
    if (!name) {
      showToast('Enter a city name.', 'warning')
      return
    }
    const btn = document.getElementById('add-city-btn')
    btn.disabled = true
    try {
      const { error } = await supabase.from('cities').insert({ name, sort_order })
      if (error) {
        if (error.code === '23505') {
          showToast('That city already exists.', 'warning')
          return
        }
        throw error
      }
      nameInput.value = ''
      sortInput.value = ''
      showToast('City added.', 'success')
      await refresh()
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Could not add city', 'error')
    } finally {
      btn.disabled = false
    }
  })

  document.getElementById('refresh-btn').addEventListener('click', refresh)

  await refresh()
})()
