# 📊 PriceWatch Pakistan

A citizen-driven price monitoring system for essential commodities across Pakistan's cities.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Open the **SQL Editor** in your Supabase dashboard
3. Copy the contents of `supabase-setup.sql` and run it
4. Go to **Settings → API** and copy your:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon/public key**

### 3. Configure Environment Variables

Edit the `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the App
```bash
npm run dev
```

Visit `http://localhost:3000`

---

## 📦 Build for Production

```bash
npm run build
```

Output is in the `dist/` folder. Deploy to Vercel, Netlify, or any static host.

---

## 📁 Project Structure

```
price-control-pakistan/
├── index.html              # Submit prices page
├── dashboard.html          # Analytics dashboard
├── history.html            # Submission history
├── admin.html              # Reference price management
├── supabase-setup.sql      # Database schema + seed data
├── .env                    # Your Supabase credentials (fill this in)
├── vite.config.js
├── package.json
└── src/
    ├── css/
    │   └── main.css        # Full design system
    └── js/
        ├── supabase.js     # Supabase client
        ├── config.js       # Cities, products, constants
        ├── api.js          # All Supabase queries
        ├── utils.js        # Formatting, validation, alerts
        ├── charts.js       # Chart.js wrappers
        ├── layout.js       # Shared sidebar/topbar
        └── pages/
            ├── submit.js   # Submit page logic
            ├── dashboard.js # Dashboard logic
            ├── history.js  # History + filtering
            └── admin.js    # Admin panel logic
```

---

## 🗄️ Database Schema

### `price_submissions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| city | TEXT | City name |
| product | TEXT | Product name |
| submitted_price | NUMERIC | Price in PKR |
| unit | TEXT | kg / litre |
| submitter_name | TEXT | Optional name |
| market_name | TEXT | Optional market |
| submitted_at | TIMESTAMPTZ | Submission time |

### `reference_prices`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| product | TEXT | Product name (unique) |
| reference_price | NUMERIC | Official price in PKR |
| unit | TEXT | kg / litre |
| updated_at | TIMESTAMPTZ | Last modified |

### `city_product_averages` (View)
Auto-calculated view with avg, min, max prices per city+product.

---

## 🏙 Supported Cities

20 major cities including Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, and more.

## 🛒 Tracked Products

| Product | Unit | Default Ref Price |
|---------|------|------------------|
| Sugar | kg | Rs. 120 |
| Atta (Wheat) | kg | Rs. 80 |
| Cooking Oil | litre | Rs. 320 |
| Rice (Basmati) | kg | Rs. 250 |
| Milk | litre | Rs. 140 |
| Chicken | kg | Rs. 450 |
| Tomatoes | kg | Rs. 60 |
| Onions | kg | Rs. 50 |
| Potatoes | kg | Rs. 40 |
| Apples | kg | Rs. 200 |

---

## ⚙️ Configuration

Edit `src/js/config.js` to:
- Add/remove cities
- Add/remove products
- Change the overpricing threshold (default: 10%)
- Adjust price validation limits

---

## ✨ Features

- **Price Submission** — Citizens submit prices with city, market, and name
- **Real-time Dashboard** — Live updates via Supabase Realtime
- **Bar Charts** — Market avg vs reference price per product
- **Price Trend** — 30-day line chart per city + product
- **City Comparison** — Horizontal bar comparing cities for one product
- **Overpricing Alerts** — Auto-flagged with severity levels (Moderate / High / Critical)
- **History Table** — Full filterable, sortable, paginated log
- **Reference Price Admin** — Update official prices from the UI
- **Fully Responsive** — Mobile-first design

---

## 🔒 Security

- Supabase Row Level Security (RLS) is enabled
- Public users can read all data and insert submissions
- Reference price updates require direct Supabase dashboard access (or add auth if needed)

---

## 📄 License

MIT — Free to use and modify.
# Price-Control-Pakistan
