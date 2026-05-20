// ============================================================
// Theme (light/dark) toggle — persists choice in localStorage
// ============================================================

const KEY = 'pc_theme'

export function getTheme() {
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

export function setTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem(KEY, next)
}

export function toggleTheme() {
  setTheme(getTheme() === 'light' ? 'dark' : 'light')
}

export function applyStoredTheme() {
  setTheme(getTheme())
}
