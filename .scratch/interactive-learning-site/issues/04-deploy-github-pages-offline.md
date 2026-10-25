# 04: Deploy to GitHub Pages and offline support

**What to build:** Every push to main publishes the site to GitHub Pages, and after the first visit it works offline. Deep links work under the Pages base path through an SPA fallback. A service worker caches the built site and content.

**Blocked by:** 01

**Status:** ready-for-human (the owner must create the GitHub repository and enable Pages; the workflow itself is agent work)

- [ ] CI workflow builds (with submodule checkout) and deploys to GitHub Pages on push to main.
- [ ] Routing works under the repository base path, including reloads on deep links.
- [ ] Service worker caches the app shell and content; the app loads offline after one visit.
- [ ] New deploys replace the cached version (no stale-forever cache), with a small "new version available" prompt.
- [ ] The repo README documents the one-time manual steps (create the repo, enable Pages).

## Comments

**From ticket 02.**
- Primer images are copied to `public/primer/` at build time and served under `<base>/primer/`. The service worker must cache them.
- One image in the "Latency numbers every programmer should know" Lesson is hot-linked from `camo.githubusercontent.com` in the primer itself. It is not in the repo, so it stays external and won't load offline unless it is cached at runtime.
