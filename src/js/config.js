// ============================================================
// App Configuration
// ============================================================

export const CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Hyderabad',
  'Sialkot',
  'Gujranwala',
  'Bahawalpur',
  'Sargodha',
  'Sukkur',
  'Larkana',
  'Mardan',
  'Abbottabad',
  'Dera Ghazi Khan',
  'Mirpur',
  'Muzaffarabad'
]

export const PRODUCTS = [
  { name: 'Sugar',          unit: 'kg',    icon: '🍬', category: 'Staples' },
  { name: 'Atta (Wheat)',   unit: 'kg',    icon: '🌾', category: 'Staples' },
  { name: 'Cooking Oil',    unit: 'litre', icon: '🫙', category: 'Staples' },
  { name: 'Rice (Basmati)', unit: 'kg',    icon: '🍚', category: 'Staples' },
  { name: 'Milk',           unit: 'litre', icon: '🥛', category: 'Dairy' },
  { name: 'Chicken',        unit: 'kg',    icon: '🍗', category: 'Meat' },
  { name: 'Tomatoes',       unit: 'kg',    icon: '🍅', category: 'Vegetables' },
  { name: 'Onions',         unit: 'kg',    icon: '🧅', category: 'Vegetables' },
  { name: 'Potatoes',       unit: 'kg',    icon: '🥔', category: 'Vegetables' },
  { name: 'Apples',         unit: 'kg',    icon: '🍎', category: 'Fruits' }
]

// Overpricing alert threshold (percentage above reference price)
export const OVERPRICE_THRESHOLD = 10 // 10%

// Price validation limits (PKR)
export const PRICE_LIMITS = {
  'Sugar':          { min: 50,  max: 500  },
  'Atta (Wheat)':   { min: 30,  max: 400  },
  'Cooking Oil':    { min: 100, max: 1000 },
  'Rice (Basmati)': { min: 80,  max: 800  },
  'Milk':           { min: 50,  max: 400  },
  'Chicken':        { min: 200, max: 1500 },
  'Tomatoes':       { min: 10,  max: 500  },
  'Onions':         { min: 10,  max: 300  },
  'Potatoes':       { min: 10,  max: 300  },
  'Apples':         { min: 50,  max: 1000 }
}

export const APP_NAME = 'PriceWatch Pakistan'
export const APP_TAGLINE = 'Citizen-driven price transparency'

/** Supabase Edge Function base: `{project}.supabase.co/functions/v1/{name}` */
export function getEdgeFunctionUrl(name) {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) return ''
  return `${base.replace(/\/$/, '')}/functions/v1/${name}`
}

