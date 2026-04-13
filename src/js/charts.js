import { Chart, registerables } from 'chart.js'
import { formatPKR, getSeverityColor, calcOverprice } from './utils.js'
import { PRODUCTS } from './config.js'

Chart.register(...registerables)

// Store chart instances to destroy before re-creating
const chartInstances = {}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy()
    delete chartInstances[id]
  }
}

// ============================================================
// Color Palette
// ============================================================

const CHART_COLORS = {
  primary:   '#c8a96e',
  secondary: '#1a3a2a',
  accent:    '#e8d5a3',
  bars:      ['#c8a96e','#a07840','#e8c87a','#8b6914','#d4a853','#b08030','#f0d890','#6b4f10','#deb860','#9a7020'],
  overpriced: '#ef4444',
  normal:    '#22c55e'
}

function getRootVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#c8a96e'
}

// ============================================================
// Bar Chart: Avg vs Reference prices
// ============================================================

export function renderAvgVsRefChart(canvasId, averages, refMap) {
  destroyChart(canvasId)
  const ctx = document.getElementById(canvasId)
  if (!ctx) return

  const labels = averages.map(a => a.product)
  const avgPrices = averages.map(a => parseFloat(a.avg_price))
  const refPrices = averages.map(a => refMap[a.product] || 0)
  const barColors = avgPrices.map((avg, i) => {
    const { isOverpriced } = calcOverprice(avg, refPrices[i])
    return isOverpriced ? '#ef4444' : '#c8a96e'
  })

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Market Price (Avg)',
          data: avgPrices,
          backgroundColor: barColors,
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Reference Price',
          data: refPrices,
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderColor: '#e8d5a3',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#d4c5a0', font: { family: "'Crimson Pro', serif", size: 13 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatPKR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#b09a70', font: { size: 11 }, maxRotation: 30 },
          grid: { color: 'rgba(200,169,110,0.1)' }
        },
        y: {
          ticks: {
            color: '#b09a70',
            callback: v => `Rs. ${v}`
          },
          grid: { color: 'rgba(200,169,110,0.1)' }
        }
      }
    }
  })
}

// ============================================================
// Line Chart: Price Trend
// ============================================================

export function renderTrendChart(canvasId, trendData, productName, refPrice) {
  destroyChart(canvasId)
  const ctx = document.getElementById(canvasId)
  if (!ctx) return

  if (!trendData || trendData.length === 0) {
    ctx.parentElement.innerHTML = '<p class="chart-empty">Not enough data for trend analysis.</p>'
    return
  }

  const labels = trendData.map(d => d.date)
  const values = trendData.map(d => d.avg)
  const refLine = trendData.map(() => refPrice)

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${productName} Avg Price`,
          data: values,
          borderColor: '#c8a96e',
          backgroundColor: 'rgba(200,169,110,0.15)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#c8a96e'
        },
        {
          label: 'Reference Price',
          data: refLine,
          borderColor: '#e8d5a3',
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#d4c5a0', font: { family: "'Crimson Pro', serif", size: 13 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatPKR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#b09a70', font: { size: 11 }, maxRotation: 45 },
          grid: { color: 'rgba(200,169,110,0.08)' }
        },
        y: {
          ticks: { color: '#b09a70', callback: v => `Rs. ${v}` },
          grid: { color: 'rgba(200,169,110,0.08)' }
        }
      }
    }
  })
}

// ============================================================
// Doughnut Chart: Overpriced vs Normal products
// ============================================================

export function renderOverpriceDonut(canvasId, overpricedCount, normalCount) {
  destroyChart(canvasId)
  const ctx = document.getElementById(canvasId)
  if (!ctx) return

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Overpriced', 'Normal'],
      datasets: [{
        data: [overpricedCount, normalCount],
        backgroundColor: ['#ef4444', '#22c55e'],
        borderColor: '#0d1f15',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#d4c5a0', font: { family: "'Crimson Pro', serif", size: 13 }, padding: 16 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} product${ctx.parsed !== 1 ? 's' : ''}`
          }
        }
      },
      cutout: '65%'
    }
  })
}

// ============================================================
// Horizontal Bar: City comparison for a single product
// ============================================================

export function renderCityComparisonChart(canvasId, cityData, refPrice) {
  destroyChart(canvasId)
  const ctx = document.getElementById(canvasId)
  if (!ctx) return

  const sorted = [...cityData].sort((a, b) => a.avg_price - b.avg_price)
  const labels = sorted.map(d => d.city)
  const values = sorted.map(d => parseFloat(d.avg_price))
  const colors = values.map(v => {
    const { isOverpriced } = calcOverprice(v, refPrice)
    return isOverpriced ? '#ef4444' : '#c8a96e'
  })

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg Market Price',
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'Reference Price',
          data: labels.map(() => refPrice),
          type: 'line',
          borderColor: '#e8d5a3',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#d4c5a0', font: { family: "'Crimson Pro', serif", size: 13 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatPKR(ctx.parsed.x)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#b09a70', callback: v => `Rs. ${v}` },
          grid: { color: 'rgba(200,169,110,0.08)' }
        },
        y: {
          ticks: { color: '#b09a70', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  })
}

export function destroyAllCharts() {
  Object.keys(chartInstances).forEach(destroyChart)
}
