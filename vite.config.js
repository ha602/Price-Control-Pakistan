import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appPhase = env.VITE_APP_PHASE || '1'

  return {
    root: '.',
    plugins: [
      {
        name: 'inject-app-phase',
        transformIndexHtml(html) {
          if (html.includes('window.__APP_PHASE__')) return html
          return html.replace(
            '<head>',
            `<head><script>window.__APP_PHASE__=${JSON.stringify(appPhase)}</script>`
          )
        }
      }
    ],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: './index.html',
          dashboard: './dashboard.html',
          history: './history.html',
          admin: './admin.html',
          login: './login.html',
          areaMonitors: './area-monitors.html'
        }
      }
    },
    server: {
      port: 3000,
      open: true
    }
  }
})
