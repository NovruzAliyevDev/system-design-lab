import { defineConfig, devices } from '@playwright/test'

const DEV_PORT = 5180
/** The production build, served like GitHub Pages under a project base path. */
const PAGES_PORT = 5181
const PAGES_BASE = '/system-design-lab/'

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      testIgnore: 'pages.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` },
    },
    {
      name: 'pages',
      testMatch: 'pages.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PAGES_PORT}${PAGES_BASE}` },
    },
  ],
  testDir: 'e2e',
  webServer: [
    {
      command: `npm run dev -- --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && tsx e2e/pages-server.ts dist ${PAGES_BASE} ${PAGES_PORT}`,
      url: `http://localhost:${PAGES_PORT}${PAGES_BASE}`,
      env: { BASE_PATH: PAGES_BASE },
      reuseExistingServer: !process.env.CI,
    },
  ],
})
