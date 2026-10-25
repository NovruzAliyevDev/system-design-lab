# 04: Deploy to GitHub Pages and offline support

**What to build:** Every push to main publishes the site to GitHub Pages, and after the first visit it works offline. Deep links work under the Pages base path through an SPA fallback. A service worker caches the built site and content.

**Blocked by:** 01

**Status:** ready-for-human (agent work is done; the owner must still create the GitHub repository and enable Pages, see the README)

- [x] CI workflow builds (with submodule checkout) and deploys to GitHub Pages on push to main.
- [x] Routing works under the repository base path, including reloads on deep links.
- [x] Service worker caches the app shell and content; the app loads offline after one visit.
- [x] New deploys replace the cached version (no stale-forever cache), with a small "new version available" prompt.
- [x] The repo README documents the one-time manual steps (create the repo, enable Pages).

## Comments

**From ticket 02.**
- Primer images are copied to `public/primer/` at build time and served under `<base>/primer/`. The service worker must cache them.
- One image in the "Latency numbers every programmer should know" Lesson is hot-linked from `camo.githubusercontent.com` in the primer itself. It is not in the repo, so it stays external and won't load offline unless it is cached at runtime.

**Done on `main` (agent part).**
- **Deploy.** `.github/workflows/deploy.yml` checks out with submodules, runs `npm test` and `npm run test:e2e`, builds and publishes with `actions/deploy-pages` on push to `main` (or by hand). The base path comes from `actions/configure-pages`, so the repo name is free; `BASE_PATH` sets it for local builds (`scripts/base-path.ts`).
- **Deep links.** The build copies `index.html` to `404.html`, which GitHub Pages serves for any unknown path. After the first visit the service worker answers navigations from its cache.
- **Offline.** `vite-plugin-pwa` (generateSW) precaches the app, the catalog and all primer images (about 9.7 MB, 40 files). No web manifest yet, so the site is not installable; that can come with an icon later.
- **Updates.** `registerType: 'prompt'`. The browser looks for a new `sw.js` on each page load, and `UpdatePrompt` also checks hourly so a tab left open notices too. A new deploy installs in the background; `UpdatePrompt` then shows "Yeni versiya hazırdır" with Yenilə / Sonra. The new version takes over on Yenilə (every open tab then reloads, since the old files leave the cache), or on the next visit once every old tab is closed.
- **camo image.** The one hot-linked image is runtime-cached (stale-while-revalidate). At the pinned commit its camo URL returns 403, so it does not load online either; that is a primer problem.
- **Tests.**
  - Vitest: `tests/base-path.test.ts`.
  - Playwright `pages` project: builds with base `/system-design-lab/`, serves `dist` with `e2e/pages-server.ts` (a stand-in for GitHub Pages: `404.html` for unknown paths), and tests deep-link reloads, offline use after one visit, and the update prompt (on reload and accepted; in a tab left open, via the hourly check, and put off). The server has a test hook that changes `sw.js` to fake a new deploy.
- **Known gap:** offline, `/<repo>` without the trailing slash is outside the service worker scope and does not load; `/<repo>/` does.
- **Left for the owner:** create the GitHub repo, set Pages source to GitHub Actions, then push (README "Deploy").
