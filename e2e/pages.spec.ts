// Runs against the production build served under the GitHub Pages base path (the `pages` project).
import { expect, test, type Page } from '@playwright/test'

/** Waits until the service worker has installed, which is when it has cached the site. */
async function serviceWorkerInstalled(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
}

async function expectLoadBalancerLesson(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Load balancer' })).toBeVisible()
  const diagram = page.getByRole('article').locator('img').first()
  await expect(diagram).toBeVisible()
  await expect.poll(() => diagram.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
}

test('opens and reloads deep links under the base path', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('lessons/load-balancer')
  await expectLoadBalancerLesson(page)

  await page.reload()
  await expectLoadBalancerLesson(page)

  await page.getByRole('navigation', { name: 'Mündəricat' }).getByRole('link', { name: 'CAP theorem' }).click()
  await expect(page).toHaveURL(/\/system-design-lab\/lessons\/cap-theorem$/)
  await expect(page.getByRole('heading', { level: 1, name: 'CAP theorem' })).toBeVisible()
})

test('works offline after one visit', async ({ page, context }) => {
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'Dərslər' })).toBeVisible()
  await serviceWorkerInstalled(page)

  await context.setOffline(true)
  // Anything the service worker has not cached now fails, so what loads below came from its cache.
  const uncachedFails = await page.evaluate(() => fetch('not-cached.txt').then(() => false, () => true))
  expect(uncachedFails).toBe(true)

  const offlineVisit = await page.goto('lessons/load-balancer')
  expect(offlineVisit?.fromServiceWorker()).toBe(true)
  await expectLoadBalancerLesson(page)
  await page.reload()
  await expectLoadBalancerLesson(page)
})

/** Opens the site, lets the service worker install, then deploys a new version; returns its prompt. */
async function deployNewVersionAfterVisit(page: Page) {
  await page.goto('')
  await serviceWorkerInstalled(page)
  await page.request.post('__bump-service-worker')
  return page.getByRole('status').filter({ hasText: 'Yeni versiya hazırdır' })
}

test('offers a newly deployed version on the next load and switches to it', async ({ page }) => {
  const prompt = await deployNewVersionAfterVisit(page)
  await page.reload()
  await expect(prompt).toBeVisible()

  // A marker on the old page shows whether the page really reloads onto the new version.
  await page.evaluate(() => Object.assign(window, { beforeUpdate: true }))
  const reloaded = page.waitForEvent('load')
  await prompt.getByRole('button', { name: 'Yenilə' }).click()
  await reloaded

  expect(await page.evaluate(() => 'beforeUpdate' in window)).toBe(false)
  await expect(prompt).toBeHidden()
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting ?? null)).toBeNull()
  await expect(page.getByRole('heading', { level: 1, name: 'Dərslər' })).toBeVisible()
})

test('offers a new version to a tab left open, which can put it off', async ({ page }) => {
  await page.clock.install()
  const prompt = await deployNewVersionAfterVisit(page)

  await page.clock.runFor('01:00:00')
  await expect(prompt).toBeVisible()

  await prompt.getByRole('button', { name: 'Sonra' }).click()
  await expect(prompt).toBeHidden()
})
