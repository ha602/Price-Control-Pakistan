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
          const earlyBoot = `
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0c1220" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="PriceControl" />
<link rel="apple-touch-icon" href="/icons/icon-192.svg" />
<script>
  (function(){
    try {
      var t = localStorage.getItem('pc_theme');
      if (t !== 'light' && t !== 'dark') t = 'dark';
      document.documentElement.setAttribute('data-theme', t);
      var l = localStorage.getItem('pc_lang');
      if (l !== 'ur' && l !== 'en') l = 'en';
      document.documentElement.setAttribute('lang', l);
      document.documentElement.setAttribute('dir', l === 'ur' ? 'rtl' : 'ltr');
    } catch (e) {}
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js').catch(function(){});
      });
    }
  })();
  window.__APP_PHASE__=${JSON.stringify(appPhase)};
</script>`
          return html.replace('<head>', `<head>${earlyBoot}`)
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
          areaMonitors: './area-monitors.html',
          map: './map.html',
          cities: './cities.html'
        }
      }
    },
    server: {
      port: 3000,
      open: true
    }
  }
})
