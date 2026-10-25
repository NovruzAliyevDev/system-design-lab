/// <reference types="vitest/config" />
import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { siteBase } from './scripts/base-path.ts'

/**
 * GitHub Pages answers any path that is not a file with `404.html`. A copy of `index.html` there
 * lets the app route deep links on a first visit or a reload, before the service worker takes over.
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-fallback',
    apply: 'build',
    configResolved: (config) => {
      outDir = config.build.outDir
    },
    writeBundle: () => copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html')),
  }
}

export default defineConfig({
  base: siteBase(process.env.BASE_PATH),
  plugins: [
    react(),
    tailwindcss(),
    spaFallback(),
    VitePWA({
      // A new deploy waits until the reader accepts the "new version" prompt, then replaces the cache.
      registerType: 'prompt',
      manifest: false,
      workbox: {
        // Control the page from the first visit, so runtime caching works then too. Updates still wait
        // for the prompt: a new worker only activates once the reader accepts or every old tab is closed.
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,json,png,jpg,jpeg,gif,svg,woff2}'],
        globIgnores: ['404.html'],
        // The app bundle carries the whole Lesson catalog, and some primer diagrams are large.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // The primer hot-links one image from GitHub's image proxy; it is cached once seen. The response
            // is opaque, so a failed one may be cached too: revalidating replaces it once the image loads again.
            urlPattern: ({ url }) => url.origin === 'https://camo.githubusercontent.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'primer-external-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
})
