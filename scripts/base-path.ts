/**
 * The Vite `base` for a site served under `basePath`, such as the GitHub Pages
 * project path that CI passes in `BASE_PATH`. Vite needs a leading and a trailing slash.
 */
export function siteBase(basePath: string | undefined): string {
  const trimmed = (basePath ?? '').replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}
