import '../../css/main.css'
import {
  signInWithPassword,
  signOut,
  getSession,
  getStaffProfile,
  hasStaffAccess,
  clearStaffProfileCache,
  getStaffLoginBlockerMessage
} from '../auth.js'

const params = new URLSearchParams(window.location.search)
const nextRaw = params.get('next') || '/dashboard.html'
const nextUrl = nextRaw.startsWith('/') ? nextRaw : '/dashboard.html'
const reason = params.get('reason')

const reasonMsg =
  reason === 'forbidden'
    ? '<p class="login-banner login-banner--warn">This account is not authorized for admin access.</p>'
    : reason === 'nopermission'
      ? '<p class="login-banner login-banner--warn">You don\'t have permission to open that page. Ask your project owner to update your row in <code>staff_profiles</code> in Supabase.</p>'
      : ''

;(async () => {
  const s = await getSession()
  if (s?.user) {
    clearStaffProfileCache()
    const profile = await getStaffProfile()
    if (hasStaffAccess(profile)) {
      window.location.replace(nextUrl)
      return
    }
  }

  document.body.classList.add('login-page-body')
  document.body.innerHTML = `
  <div class="login-page">
    <a href="/index.html" class="login-page__back">← Back to public site</a>
    <div class="login-card">
      <div class="login-card__brand">
        <span class="login-card__mark" aria-hidden="true"></span>
        <div>
          <h1 class="login-card__title">Admin sign in</h1>
          <p class="login-card__subtitle">Sign in with an account that has a row in <code>staff_profiles</code> (created in Supabase).</p>
        </div>
      </div>
      ${reasonMsg}
      <form id="login-form" class="login-form">
        <div class="form-group">
          <label class="form-label" for="login-email">Email</label>
          <input type="email" id="login-email" name="email" autocomplete="username" required placeholder="you@example.com" />
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Password</label>
          <input type="password" id="login-password" name="password" autocomplete="current-password" required />
        </div>
        <p class="login-form__error hidden" id="login-error"></p>
        <button type="submit" class="btn btn--primary btn--full btn--lg" id="login-submit">Sign in</button>
      </form>
    </div>
  </div>
`

  const form = document.getElementById('login-form')
  const errEl = document.getElementById('login-error')
  const submitBtn = document.getElementById('login-submit')

  form.addEventListener('submit', async e => {
    e.preventDefault()
    errEl.classList.add('hidden')
    errEl.textContent = ''
    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-password').value

    submitBtn.classList.add('btn--loading')
    submitBtn.disabled = true

    try {
      const { data, error } = await signInWithPassword(email, password)
      if (error) {
        errEl.textContent = error.message || 'Sign in failed.'
        errEl.classList.remove('hidden')
        return
      }
      if (!data.user) {
        errEl.textContent = 'Sign in failed.'
        errEl.classList.remove('hidden')
        return
      }
      clearStaffProfileCache()
      const profile = await getStaffProfile()
      if (!hasStaffAccess(profile)) {
        await signOut()
        errEl.textContent =
          getStaffLoginBlockerMessage(profile) ||
          'This account has no admin profile in staff_profiles. Add the user in Supabase Auth, then insert their UUID into staff_profiles.'
        errEl.classList.remove('hidden')
        return
      }
      window.location.href = nextUrl
    } catch (err) {
      console.error(err)
      errEl.textContent = 'Something went wrong. Try again.'
      errEl.classList.remove('hidden')
    } finally {
      submitBtn.classList.remove('btn--loading')
      submitBtn.disabled = false
    }
  })
})()
