import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        dashboard: './dashboard.html',
        history: './history.html',
        admin: './admin.html',
        login: './login.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})
