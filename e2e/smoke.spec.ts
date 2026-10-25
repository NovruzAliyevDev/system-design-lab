import { expect, test } from '@playwright/test'

test('opens the app and reads a Lesson', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dərslər' })).toBeVisible()

  await page.getByRole('main').getByRole('link', { name: 'Load balancer', exact: true }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Load balancer' })).toBeVisible()
  await expect(page.getByText('Load balancers distribute incoming client requests')).toBeVisible()
})

test('moves through Lessons with the sidebar, primer links and next/previous', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/lessons/load-balancer')

  const toc = page.getByRole('navigation', { name: 'Mündəricat' })
  await expect(toc.getByRole('link', { name: 'Load balancer', exact: true })).toHaveAttribute('aria-current', 'page')

  const diagram = page.getByRole('article').locator('img').first()
  await expect(diagram).toBeVisible()
  expect(await diagram.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  await page.getByRole('link', { name: 'active-passive' }).first().click()
  await expect(page).toHaveURL(/\/lessons\/fail-over#active-passive$/)
  await expect(page.locator('#active-passive')).toBeInViewport()

  await page.getByRole('link', { name: /Növbəti dərs/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Fail-over')
  await page.getByRole('link', { name: /Əvvəlki dərs/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fail-over' })).toBeVisible()

  await toc.getByRole('link', { name: 'CAP theorem' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'CAP theorem' })).toBeVisible()
})
