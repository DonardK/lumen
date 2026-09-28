import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "media-src 'self' blob: http://127.0.0.1:*",
  "connect-src 'self' http://127.0.0.1:*",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

function lumenContentSecurityPolicy() {
  return {
    name: 'lumen-csp',
    apply: 'build',
    transformIndexHtml() {
      return {
        tags: [
          {
            tag: 'meta',
            injectTo: 'head-prepend',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: CONTENT_SECURITY_POLICY,
            },
          },
        ],
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), lumenContentSecurityPolicy()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
