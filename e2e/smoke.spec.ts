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

test('jumps from a Lesson to another through search, by keyboard', async ({ page }) => {
  await page.goto('/lessons/load-balancer')
  await expect(page.getByRole('heading', { level: 1, name: 'Load balancer' })).toBeVisible()

  // The emulated desktop is not a Mac, so the shortcut is Ctrl+K.
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', { name: 'Axtar' })
  const input = dialog.getByRole('combobox', { name: 'Axtar' })
  await expect(input).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.keyboard.press('Control+k')
  await input.fill('eventual consistency')
  const results = dialog.getByRole('option')
  await expect(results.first()).toContainText('Eventual consistency')
  await expect(results.first()).toContainText('Consistency patterns')
  await expect(results.first().locator('mark').first()).toHaveText(/^eventual$/i)

  await input.press('ArrowDown')
  await expect(results.nth(1)).toHaveAttribute('aria-selected', 'true')
  await input.press('ArrowUp')
  await expect(results.first()).toHaveAttribute('aria-selected', 'true')
  await input.press('Enter')

  await expect(page).toHaveURL(/\/lessons\/eventual-consistency$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Eventual consistency' })).toBeVisible()
  await expect(dialog).toBeHidden()
})

test('explains a Glossary Term in a Lesson and lists it on the Glossary page', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/lessons/fail-over')
  const term = page.getByRole('article').getByRole('button', { name: 'heartbeats' })
  const explanation = page.getByText('Serverlərin bir-birinə müntəzəm göndərdiyi')

  // Hovering shows the explanation until the mouse moves away.
  await term.hover()
  await expect(explanation).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(explanation).toBeHidden()

  // A click keeps it open, Esc closes it.
  await term.click()
  await page.mouse.move(0, 0)
  await expect(explanation).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(explanation).toBeHidden()

  await term.click()
  await page.getByRole('link', { name: 'Lüğətdə bax' }).click()
  await expect(page).toHaveURL(/\/glossary#heartbeat$/)
  const entry = page.locator('#heartbeat')
  await expect(entry).toBeInViewport()
  await expect(entry).toContainText('Serverlərin bir-birinə müntəzəm göndərdiyi')

  await entry.getByRole('link', { name: 'Fail-over' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fail-over' })).toBeVisible()
})

test('finds a Glossary Term through search', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dərslər' })).toBeVisible()
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', { name: 'Axtar' })
  await dialog.getByRole('combobox', { name: 'Axtar' }).fill('quorum')
  await expect(dialog.getByRole('option').first()).toContainText('Lüğət')
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/glossary#quorum$/)
  await expect(page.locator('#quorum')).toBeInViewport()
})

test.describe('on a touch phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

  test('opens a Glossary tooltip with a tap and keeps it on screen', async ({ page }) => {
    await page.goto('/lessons/fail-over')
    const term = page.getByRole('article').getByRole('button', { name: 'heartbeats' })
    const explanation = page.getByText('Serverlərin bir-birinə müntəzəm göndərdiyi')

    await term.tap()
    await expect(explanation).toBeVisible()
    const box = await explanation.locator('..').boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(375)

    await page.getByRole('heading', { level: 1 }).tap()
    await expect(explanation).toBeHidden()
  })
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

test('sorts and filters the latency numbers table of the appendix', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/lessons/latency-numbers-every-programmer-should-know')
  const table = page.getByRole('table', { name: 'Gecikmə rəqəmləri' })
  const rows = table.locator('tbody tr')
  await expect(rows).toHaveCount(15)
  await expect(rows.first()).toContainText('L1 cache reference')

  const sortByLatency = table.getByRole('button', { name: 'Gecikmə (ns)' })
  await sortByLatency.click()
  await expect(table.getByRole('columnheader', { name: 'Gecikmə (ns)' })).toHaveAttribute('aria-sort', 'ascending')
  await sortByLatency.click()
  await expect(table.getByRole('columnheader', { name: 'Gecikmə (ns)' })).toHaveAttribute('aria-sort', 'descending')
  await expect(rows.first()).toContainText('Send packet CA->Netherlands->CA')
  await expect(rows.first()).toContainText('150 ms')

  await page.getByLabel('Cədvəldə süz').fill('memory')
  await expect(page.getByText('5 / 15 sətir')).toBeVisible()
  // Still sorted, slowest first.
  await expect(rows.first()).toContainText('Read 1 MB sequentially from HDD')
  await page.getByLabel('Cədvəldə süz').fill('no such operation')
  await expect(page.getByText('Heç bir sətir uyğun gəlmir.')).toBeVisible()
})

test('reads a Solution page from the primer, with its diagrams and links back to Lessons', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/lessons/system-design-interview-questions-with-solutions')
  await page.getByRole('article').getByRole('link', { name: 'Solution', exact: true }).first().click()

  await expect(page).toHaveURL(/\/solutions\/pastebin$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Design Pastebin.com (or Bit.ly)' })).toBeVisible()
  await expect(page.getByRole('article').getByRole('link', { name: 'GitHub-da mənbəyə bax' })).toHaveAttribute(
    'href',
    /\/blob\/[0-9a-f]{40}\/solutions\/system_design\/pastebin\/README\.md$/,
  )
  const diagram = page.getByRole('article').locator('img').first()
  await diagram.scrollIntoViewIfNeeded()
  await expect.poll(() => diagram.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  // A link to a section of the primer on GitHub opens its Lesson in the app.
  await page.getByRole('article').getByRole('link', { name: 'system design topics', exact: true }).first().click()
  await expect(page).toHaveURL(/\/lessons\/index-of-system-design-topics$/)

  await page.getByRole('banner').getByRole('link', { name: 'Həllər' }).click()
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(8)
  await page.getByRole('main').getByRole('link', { name: 'Design a system that scales to millions of users on AWS' }).click()
  await expect(page).toHaveURL(/\/solutions\/scaling_aws$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Design a system that scales to millions of users on AWS' })).toBeVisible()
})

test('follows the study guide of a chosen timeline to its Lessons', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Öyrənmə planı' }).click()

  await expect(page.getByRole('tab', { name: 'Qısa müddət' })).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByRole('listitem')).toHaveCount(7)
  await expect(panel).toContainText('bir neçəsini')

  await page.getByRole('tab', { name: 'Uzun müddət' }).click()
  await expect(page).toHaveURL(/\/study-guide\?timeline=long$/)
  await expect(panel).toContainText('Practice by solving most interview questions.')
  await expect(panel).toContainText('demək olar hamısını')

  await page.reload()
  await expect(page.getByRole('tab', { name: 'Uzun müddət' })).toHaveAttribute('aria-selected', 'true')
  await panel.getByRole('link', { name: 'Real world architectures' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Real world architectures' })).toBeVisible()
})
