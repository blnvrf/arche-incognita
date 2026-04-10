import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// TAURI_ENV_TARGET_TRIPLE is injected by `tauri dev` and `tauri build`
const isDesktop = process.env.TAURI_ENV_TARGET_TRIPLE !== undefined;

export default defineConfig({
  plugins: [react()],
  base: isDesktop ? './' : '/arche-incognita/',

  // Tauri dev server must bind to a fixed port matching tauri.conf.json devUrl
  server: isDesktop
    ? { port: 5173, strictPort: true, host: '127.0.0.1' }
    : {},

  // Faster, compatible build targets for the desktop binary
  build: isDesktop
    ? { target: ['es2021', 'chrome105', 'safari15'], sourcemap: false }
    : {},
})
