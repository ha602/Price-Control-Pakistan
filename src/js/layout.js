// Shared layout: sidebar, topbar, mobile nav

import { getSession, getStaffProfile, hasStaffAccess, hasPermission, signOut } from './auth.js'

/** @typedef {{ profile?: object | null, session?: object, userEmail?: string | null, showAdminNav?: boolean }} LayoutOptions */

/**
 * Renders shell. Admin nav links depend on `staff_profiles` permissions.
 */
export async function renderLayout(pageTitle, activePage, options = {}) {
  const session = options.session ?? (await getSession())
  let profile = options.profile
  if (profile === undefined && session?.user) {
    profile = await getStaffProfile()
  }

  let userEmail = options.userEmail ?? session?.user?.email ?? null

  const hasAccess = hasStaffAccess(profile)

  const showDash = hasPermission(profile, 'dashboard')
  const showHist = hasPermission(profile, 'history')
  const showRef = hasPermission(profile, 'reference')

  const insights =
    hasAccess && (showDash || showHist)
      ? `
        <div class="nav-section-label" style="margin-top:0.75rem">Insights</div>
        ${
          showDash
            ? `<a href="/dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
          <span class="nav-item__icon">📈</span> Dashboard
        </a>`
            : ''
        }
        ${
          showHist
            ? `<a href="/history.html" class="nav-item ${activePage === 'history' ? 'active' : ''}">
          <span class="nav-item__icon">🗂</span> History
        </a>`
            : ''
        }
      `
      : ''

  const adminSec =
    hasAccess && showRef
      ? `
        <div class="nav-section-label" style="margin-top:0.75rem">Administration</div>
        <a href="/admin.html" class="nav-item ${activePage === 'admin' ? 'active' : ''}">
          <span class="nav-item__icon">⚙️</span> Reference Prices
        </a>
      `
      : ''

  const adminBlock = insights + adminSec

  const footerAccount = hasAccess
    ? `
        <div class="sidebar__account">
          <span class="sidebar__account-email" title="${userEmail || ''}">${userEmail ? escapeHtml(userEmail) : 'Admin'}</span>
          <button type="button" class="btn btn--ghost btn--sm btn--full" id="sidebar-signout">Sign out</button>
        </div>
      `
    : `
        <a href="/login.html?next=/dashboard.html" class="sidebar__staff-link">Admin sign in</a>
      `

  document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <!-- Sidebar overlay (mobile) -->
    <div class="sidebar-overlay hidden" id="sidebar-overlay"></div>

    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar__logo">
        <div class="sidebar__logo-mark" aria-hidden="true"></div>
        <div class="sidebar__logo-text">
          <h2>PriceWatch</h2>
          <p>Pakistan</p>
        </div>
      </div>
      <nav class="sidebar__nav">
        <div class="nav-section-label">Public</div>
        <a href="/index.html" class="nav-item ${activePage === 'submit' ? 'active' : ''}">
          <span class="nav-item__icon">📝</span> Submit Prices
        </a>
        ${adminBlock}
      </nav>
      <div class="sidebar__footer">
        ${footerAccount}
        <div class="sidebar__copyright">&copy; ${new Date().getFullYear()} PriceWatch Pakistan</div>
        <span class="sidebar__tagline">Citizen-driven transparency</span>
      </div>
    </aside>

    <!-- Main layout -->
    <div class="main-content">
      <header class="topbar">
        <button class="hamburger" id="hamburger" aria-label="Toggle menu">☰</button>
        <span class="topbar__title">${escapeHtml(pageTitle)}</span>
        <div class="topbar__meta">
          <span class="realtime-dot" id="realtime-status">Live</span>
        </div>
      </header>

      <div class="page-inner" id="page-content"></div>
    </div>
  `
  )

  const hamburger = document.getElementById('hamburger')
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebar-overlay')

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open')
    overlay.classList.toggle('hidden')
  })
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open')
    overlay.classList.add('hidden')
  })

  const signoutBtn = document.getElementById('sidebar-signout')
  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      await signOut()
      window.location.href = '/index.html'
    })
  }

  return document.getElementById('page-content')
}

function escapeHtml(s) {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

export function setRealtimeStatus(connected) {
  const el = document.getElementById('realtime-status')
  if (!el) return
  el.textContent = connected ? 'Live' : 'Offline'
  el.style.opacity = connected ? '1' : '0.4'
}

export function updateAlertBadge(count) {
  const badge = document.querySelector('.nav-item__badge')
  if (!badge) {
    const dashLink = document.querySelector('.nav-item[href="/dashboard.html"]')
    if (dashLink && count > 0) {
      const b = document.createElement('span')
      b.className = 'nav-item__badge'
      b.textContent = count
      dashLink.appendChild(b)
    }
  } else {
    if (count > 0) badge.textContent = count
    else badge.remove()
  }
}
