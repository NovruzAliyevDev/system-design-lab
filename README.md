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

`npm test` runs Vitest (Core and pipeline tests). `npm run test:e2e` runs the Playwright smoke tests; run `npx playwright install chromium` once before the first run.

## Layout

- `src/core`: the domain logic. It is pure TypeScript, with no React, browser or Node APIs; the `tsconfig.core.json` and `tests/core-purity.test.ts` checks enforce this.
- `scripts`: the build-time Content Pipeline.
- `src/ui`: the React UI, which renders Core output. Its strings live in `src/ui/i18n`.
- `.scratch/interactive-learning-site`: the spec and tickets.
