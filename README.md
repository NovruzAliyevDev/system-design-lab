# System Design Lab

An interactive learning site built on [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer) (CC BY 4.0). The UI is in Azerbaijani; primer content stays in English.

## Setup

```bash
git clone --recurse-submodules <this repo>
npm install
```

If you cloned without `--recurse-submodules`, fetch the primer with:

```bash
git submodule update --init
```

The primer lives in `vendor/system-design-primer`, pinned to a specific commit. The build only reads that checkout and never fetches content from the network.

## Run

```bash
npm run dev
```

`npm run dev` and `npm run build` first run the Content Pipeline (`npm run content`). It turns the primer README into the Lesson catalog the app loads.

## Test

```bash
npm test
npm run test:e2e
```

`npm test` runs Vitest (Core and pipeline tests). `npm run test:e2e` runs the Playwright tests; run `npx playwright install chromium` once before the first run. The `chromium` project runs against the dev server. The `pages` project builds the site under the base path `/system-design-lab/` and serves it like GitHub Pages, to test deep links, offline use and updates.

## Deploy

`.github/workflows/deploy.yml` runs the Vitest and Playwright tests, builds the site and publishes it to GitHub Pages on every push to `main`. The build reads the Pages base path from `actions/configure-pages`, so the repository can have any name. To build for a base path locally, set `BASE_PATH` (for example `BASE_PATH=/system-design-lab npm run build`).

One-time setup on GitHub:

1. Create an empty repository on GitHub.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. Do this before the first push: without it, the workflow fails at `actions/configure-pages`.
3. Push this repo to it. The submodule is only a pin; the workflow fetches the primer from its own GitHub repository.

   ```bash
   git remote add origin https://github.com/<owner>/<repo>.git
   git push -u origin main
   ```

4. The push starts **Deploy to GitHub Pages** (see the **Actions** tab). The site is then at `https://<owner>.github.io/<repo>/`. If a run failed because Pages was not enabled yet, start the workflow again by hand from the **Actions** tab.

### Offline use and updates

A service worker caches the app and the primer images on the first visit, so the site then works offline. The one image the primer hot-links from `camo.githubusercontent.com` is cached once it has been viewed online; at the pinned commit that link returns 403, so the image is missing online too.

After a new deploy, the site shows a "new version" prompt on the next page load, or within an hour in a tab left open. The new version takes over when the reader accepts it, and every open tab then reloads. Otherwise it takes over on the next visit, once all tabs of the old version are closed. Offline, the site must be opened under its base path with the trailing slash (`/<repo>/`), which is where the service worker is registered.

GitHub Pages serves `404.html` for any path that is not a file. The build writes a copy of `index.html` there, so deep links and reloads work before the service worker is installed.

## Layout

- `src/core`: the domain logic. It is pure TypeScript, with no React, browser or Node APIs; the `tsconfig.core.json` and `tests/core-purity.test.ts` checks enforce this.
- `scripts`: build-time code: the Content Pipeline, and the site base path used by `vite.config.ts`.
- `src/ui`: the React UI, which renders Core output. Its strings live in `src/ui/i18n`.
- `.scratch/interactive-learning-site`: the spec and tickets.
