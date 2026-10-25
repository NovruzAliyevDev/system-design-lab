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
  // Visible means laid out, not loaded: wait for the image itself.
  await expect.poll(() => diagram.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

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

test('remembers read Lessons and restores them from an exported file after a reset', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  const toc = page.getByRole('navigation', { name: 'Mündəricat' })
  const readMarker = (title: string) =>
    toc.getByRole('link', { name: title, exact: true }).locator('..').getByRole('img', { name: 'Oxunub' })

  // Marked by hand: a long Lesson, so its end is not in view.
  await page.goto('/lessons/nosql')
  await expect(readMarker('NoSQL')).toBeHidden()
  await page.getByRole('button', { name: 'Oxunmuş kimi işarələ' }).click()
  await expect(readMarker('NoSQL')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Oxunmamış kimi işarələ' })).toBeVisible()

  // Marked automatically on reaching the end.
  await toc.getByRole('link', { name: 'When to update the cache' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'When to update the cache' })).toBeVisible()
  await expect(readMarker('When to update the cache')).toBeHidden()
  await page.getByRole('link', { name: /Növbəti dərs/ }).scrollIntoViewIfNeeded()
  await expect(readMarker('When to update the cache')).toBeVisible()

  // A Lesson short enough to show its end at once is read on opening.
  await toc.getByRole('link', { name: 'Latency vs throughput' }).click()
  await expect(readMarker('Latency vs throughput')).toBeVisible()

  await page.reload()
  await expect(readMarker('Latency vs throughput')).toBeVisible()
  await expect(readMarker('NoSQL')).toBeVisible()
  await expect(readMarker('When to update the cache')).toBeVisible()

  await page.getByRole('link', { name: 'Tənzimləmələr' }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'İrəliləyişi ixrac et' }).click()
  const exported = await (await downloadEvent).path()

  await page.getByRole('button', { name: 'Bütün irəliləyişi sıfırla' }).click()
  await page.getByRole('button', { name: 'Bəli, sıfırla' }).click()
  await expect(page.getByRole('status')).toHaveText('Sıfırlandı.')
  await expect(readMarker('NoSQL')).toBeHidden()
  await expect(readMarker('When to update the cache')).toBeHidden()

  await page.getByLabel('İrəliləyişi idxal et').setInputFiles(exported)
  await expect(page.getByRole('status')).toContainText('İrəliləyiş idxal olundu')
  await expect(readMarker('NoSQL')).toBeVisible()
  await expect(readMarker('When to update the cache')).toBeVisible()
  await expect(readMarker('Latency vs throughput')).toBeVisible()
})

test('rejects an invalid progress file without changing progress', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/lessons/nosql')
  await page.getByRole('button', { name: 'Oxunmuş kimi işarələ' }).click()

  await page.getByRole('link', { name: 'Tənzimləmələr' }).click()
  await page
    .getByLabel('İrəliləyişi idxal et')
    .setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion": 99}') })

  await expect(page.getByRole('status')).toContainText('Heç nə dəyişmədi')
  const toc = page.getByRole('navigation', { name: 'Mündəricat' })
  await expect(toc.getByRole('link', { name: 'NoSQL', exact: true }).locator('..').getByRole('img', { name: 'Oxunub' })).toBeVisible()
})

test('starts dark and keeps the light theme once chosen', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expect(page.getByRole('radio', { name: 'Tünd' })).toBeChecked()

  await page.getByRole('radio', { name: 'Açıq' }).check()
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)

  await page.reload()
  await expect(page.getByRole('radio', { name: 'Açıq' })).toBeChecked()
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
})

test('reads on a phone: wide tables scroll on their own and the table of contents is a drawer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/lessons/study-guide')

  await expect(page.getByRole('heading', { level: 1, name: 'Study guide' })).toBeVisible()
  await expect(page.getByRole('article')).not.toContainText(':+1:')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  const toc = page.getByRole('navigation', { name: 'Mündəricat' })
  await expect(toc).toBeHidden()
  await page.getByRole('button', { name: 'Mündəricat' }).click()
  await toc.getByRole('link', { name: 'Load balancer', exact: true }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Load balancer' })).toBeVisible()
  await expect(toc).toBeHidden()
})
