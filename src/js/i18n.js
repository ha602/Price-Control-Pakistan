// ============================================================
// Lightweight i18n (English / Urdu) — persists in localStorage
// ============================================================

const KEY = 'pc_lang'

export const STRINGS = {
  en: {
    'nav.public': 'Public',
    'nav.submit': 'Submit Prices',
    'nav.insights': 'Insights',
    'nav.dashboard': 'Dashboard',
    'nav.history': 'History',
    'nav.map': 'Map',
    'nav.admin': 'Administration',
    'nav.reference': 'Reference Prices',
    'nav.cities': 'Cities',
    'nav.areaMonitors': 'Area monitors',
    'nav.adminSignin': 'Admin sign in',
    'nav.signout': 'Sign out',
    'topbar.live': 'Live',
    'topbar.offline': 'Offline',
    'topbar.lightMode': 'Light',
    'topbar.darkMode': 'Dark',
    'topbar.urdu': 'اردو',
    'topbar.english': 'English',
    'dashboard.title': 'Price Dashboard',
    'dashboard.subtitle': "Real-time market price analysis across Pakistan's cities.",
    'dashboard.priceIndex': 'National Price Index',
    'dashboard.priceIndexHint': 'Average market price deviation from official reference prices across all reporting cities.',
    'dashboard.topOverpriced': 'Top Overpriced Cities',
    'dashboard.topOverpricedHint': 'Cities with the largest average gap above reference prices.',
    'dashboard.noData': 'No data yet',
    'map.title': 'Price Map of Pakistan',
    'map.subtitle': 'Each city is coloured by how far market prices are above the official reference.',
    'map.legendNormal': 'Within reference',
    'map.legendMild': 'Slightly above',
    'map.legendHigh': 'Highly overpriced',
    'map.noData': 'No reports',
    'common.refresh': 'Refresh',
    'common.city': 'City',
    'common.allCities': 'All Cities (National)'
  },
  ur: {
    'nav.public': 'عوامی',
    'nav.submit': 'قیمتیں جمع کریں',
    'nav.insights': 'بصیرت',
    'nav.dashboard': 'ڈیش بورڈ',
    'nav.history': 'تاریخچہ',
    'nav.map': 'نقشہ',
    'nav.admin': 'انتظامیہ',
    'nav.reference': 'حوالہ قیمتیں',
    'nav.cities': 'شہر',
    'nav.areaMonitors': 'علاقائی نگران',
    'nav.adminSignin': 'منتظم لاگ ان',
    'nav.signout': 'لاگ آؤٹ',
    'topbar.live': 'لائیو',
    'topbar.offline': 'آف لائن',
    'topbar.lightMode': 'روشن',
    'topbar.darkMode': 'تاریک',
    'topbar.urdu': 'اردو',
    'topbar.english': 'English',
    'dashboard.title': 'قیمت ڈیش بورڈ',
    'dashboard.subtitle': 'پاکستان کے شہروں میں مارکیٹ کی قیمتوں کا براہ راست تجزیہ۔',
    'dashboard.priceIndex': 'قومی قیمت انڈیکس',
    'dashboard.priceIndexHint': 'تمام رپورٹنگ شہروں میں سرکاری حوالہ قیمتوں سے اوسط انحراف۔',
    'dashboard.topOverpriced': 'سب سے مہنگے شہر',
    'dashboard.topOverpricedHint': 'وہ شہر جہاں حوالہ قیمت سے سب سے زیادہ فرق ہے۔',
    'dashboard.noData': 'ابھی کوئی ڈیٹا نہیں',
    'map.title': 'پاکستان کا قیمت نقشہ',
    'map.subtitle': 'ہر شہر کا رنگ بتاتا ہے کہ مارکیٹ ریٹ سرکاری حوالہ سے کتنا زیادہ ہے۔',
    'map.legendNormal': 'حوالہ کے اندر',
    'map.legendMild': 'تھوڑا زیادہ',
    'map.legendHigh': 'بہت زیادہ',
    'map.noData': 'کوئی رپورٹ نہیں',
    'common.refresh': 'تازہ کریں',
    'common.city': 'شہر',
    'common.allCities': 'تمام شہر (قومی)'
  }
}

export function getLang() {
  const stored = localStorage.getItem(KEY)
  return stored === 'ur' ? 'ur' : 'en'
}

export function setLang(lang) {
  const next = lang === 'ur' ? 'ur' : 'en'
  localStorage.setItem(KEY, next)
  document.documentElement.setAttribute('lang', next)
  document.documentElement.setAttribute('dir', next === 'ur' ? 'rtl' : 'ltr')
}

export function toggleLang() {
  setLang(getLang() === 'ur' ? 'en' : 'ur')
}

export function t(key) {
  const lang = getLang()
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key
}

export function applyStoredLang() {
  setLang(getLang())
}
