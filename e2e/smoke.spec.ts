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

test('reviews a Flashcard and keeps its schedule across a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Kartlar' }).click()
  await expect(page.getByText('Bu gün: 20 kart · yeni 20 · öyrənilir 0 · təkrar 0')).toBeVisible()

  const front = page.getByRole('region', { name: 'Sual' })
  await expect(front).toHaveText('Performance vs scalability')
  await page.getByRole('button', { name: 'Cavabı göstər' }).click()
  await expect(page.getByRole('region', { name: 'Cavab' })).toContainText('A service is scalable')

  // Easy graduates a new card for four days, so it leaves today's review.
  await page.getByRole('button', { name: /Asan/ }).click()
  await expect(front).toHaveText('Latency vs throughput')
  await expect(page.getByText('Bu gün: 19 kart · yeni 19 · öyrənilir 0 · təkrar 0')).toBeVisible()

  await page.reload()
  await expect(front).toHaveText('Latency vs throughput')
  await expect(page.getByText('Bu gün: 19 kart · yeni 19 · öyrənilir 0 · təkrar 0')).toBeVisible()
})

test('completes a daily review of a Deck with the keyboard, within the new-card limit', async ({ page }) => {
  await page.goto('/settings')
  await page.getByLabel('Gündə ən çox yeni kart').fill('2')

  await page.getByRole('link', { name: 'Kartlar' }).first().click()
  await page.getByLabel('Nəyi təkrar edirsiniz').selectOption({ label: 'OO Design (6)' })
  await expect(page).toHaveURL(/\/flashcards\?deck=oo-design$/)
  await expect(page.getByText('Bu gün: 2 kart · yeni 2 · öyrənilir 0 · təkrar 0')).toBeVisible()

  const front = page.getByRole('region', { name: 'Sual' })
  await expect(front).toHaveText('Design a deck of cards')
  // Away from the Deck picker, whose keys choose an option.
  await front.click()
  await page.keyboard.press('Space')
  await expect(page.getByRole('region', { name: 'Cavab' })).toContainText('Constraints and assumptions')
  await expect(page.getByRole('region', { name: 'İzah' })).toContainText('Card və Deck')
  const card = page.getByRole('article', { name: 'Kartlar' })
  await expect(card.getByRole('link', { name: 'Object-oriented design interview questions with solutions' })).toBeVisible()
  // Easy: the card graduates and leaves today's review.
  await page.keyboard.press('4')

  await expect(front).toHaveText('Design a call center')
  await page.keyboard.press('Enter')
  // Good: the card moves to its next learning step, 10 minutes away, which today's review still shows.
  await page.keyboard.press('3')
  await expect(page.getByText('Bu gün: 1 kart · yeni 0 · öyrənilir 1 · təkrar 0')).toBeVisible()
  await expect(front).toHaveText('Design a call center')
  await page.keyboard.press('Space')
  await page.keyboard.press('3')

  await expect(page.getByRole('status')).toContainText('Bugünkü təkrar bitdi.')
  await expect(page.getByRole('status')).toContainText('Bugünkü yeni kart limiti (2) doldu')
  const stats = page.getByRole('listitem', { name: 'OO Design' })
  await expect(stats.getByRole('definition')).toHaveText(['4', '0', '2', '0', '0'])
})

test('answers the quiz at the end of a Lesson, with feedback per option, and keeps the best score', async ({ page }) => {
  await page.goto('/lessons/when-to-update-the-cache')
  const quiz = page.getByRole('region', { name: 'Test' })
  const question = (prompt: RegExp) => quiz.getByRole('listitem').filter({ has: page.getByRole('group', { name: prompt }) })

  // Ordering: move each step up to its place, first step first.
  const ordering = question(/addımlarını sıraya düzün/)
  const steps = ['Girişi keşdə axtar', 'Girişi bazadan yüklə', 'Girişi keşə əlavə et', 'Girişi qaytar']
  for (const [target, step] of steps.entries()) {
    const texts = await ordering.getByRole('listitem').allInnerTexts()
    const current = texts.findIndex((text) => text.includes(step))
    for (let i = current; i > target; i--) await ordering.getByRole('button', { name: `Yuxarı: ${step}` }).click()
  }
  await ordering.getByRole('button', { name: 'Yoxla' }).click()
  await expect(ordering.getByRole('status')).toHaveText('Doğrudur!')

  const writeThrough = question(/sinxron yazır/)
  await writeThrough.getByLabel('Cache-aside').check()
  await writeThrough.getByRole('button', { name: 'Yoxla' }).click()
  await expect(writeThrough.getByRole('status')).toHaveText('Səhvdir.')
  await expect(writeThrough.getByText('Sizin seçiminiz səhvdir')).toBeVisible()
  await expect(writeThrough.getByText('Doğru cavab')).toBeVisible()
  await expect(writeThrough.getByText('keş bazaya toxunmur')).toBeVisible()
  await expect(writeThrough.getByText('bazaya asinxron, sonradan ötürür')).toBeVisible()
  await expect(writeThrough.getByLabel('Write-through')).toBeDisabled()

  const dataLoss = question(/məlumat itə bilər/)
  await dataLoss.getByLabel('Write-behind (write-back)').check()
  await dataLoss.getByRole('button', { name: 'Yoxla' }).click()

  const drawbacks = question(/Cache-aside-ın çatışmazlıqları/)
  await expect(drawbacks.getByRole('button', { name: 'Yoxla' })).toBeDisabled()
  await drawbacks.getByLabel('Hər cache miss üç səfər tələb edir').check()
  await drawbacks.getByLabel('Bazada yenilənən məlumat keşdə köhnələ bilər').check()
  await drawbacks.getByRole('button', { name: 'Yoxla' }).click()
  await expect(drawbacks.getByRole('status')).toHaveText('Qismən doğrudur: 67%')

  await expect(quiz.getByText(/^Nəticə:/)).toBeHidden()
  const refreshAhead = question(/Refresh-ahead/)
  await refreshAhead.getByLabel(/düzgün proqnozlaşdırılmayanda/).check()
  await refreshAhead.getByRole('button', { name: 'Yoxla' }).click()

  // 1 + 0 + 1 + 2/3 + 1 of 5 points.
  await expect(quiz.getByText('Nəticə: 3,7 / 5 bal (73%)')).toBeVisible()
  await expect(quiz.getByText('Nəticə yadda saxlanıldı.')).toBeVisible()
  await page.reload()
  await expect(quiz.getByText(/^Ən yaxşı nəticə: 73% · son cəhd:/)).toBeVisible()
  await expect(quiz.getByRole('button', { name: 'Yoxla' })).toHaveCount(5)
})

test('builds a sandbox Design by drag and drop, and keeps it after a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/sandbox')
  const palette = page.getByRole('navigation', { name: 'Komponentlər' })
  const canvas = page.getByTestId('rf__wrapper')

  await palette.getByRole('button', { name: 'Web server: kətana əlavə et' }).dragTo(canvas, { targetPosition: { x: 200, y: 150 } })
  await palette.getByRole('button', { name: 'Cache: kətana əlavə et' }).dragTo(canvas, { targetPosition: { x: 550, y: 300 } })
  const webServer = page.getByTestId('node-web-server-1')
  const cache = page.getByTestId('node-cache-1')
  await expect(webServer).toBeVisible()
  await expect(cache).toBeVisible()

  // The panel configures the Node just added.
  const panel = page.getByRole('region', { name: 'Tənzimləmə' })
  await panel.getByLabel('Ad').fill('Redis')
  await panel.getByLabel('Keşləmə strategiyası').selectOption('write-through')
  const instances = panel.getByLabel('Nüsxə sayı')
  await instances.fill('0')
  await expect(panel.getByRole('alert')).toHaveText('Ən az 1, ən çox 1000 ola bilər.')
  await expect(cache).not.toContainText('×0')
  await instances.fill('3')
  await expect(cache).toContainText('Redis')
  await expect(cache).toContainText('Write-through · LRU · ×3')
  await expect(panel.getByText('50 000 sorğu/san')).toBeVisible()

  await webServer.locator('.react-flow__handle.source').dragTo(cache.locator('.react-flow__handle.target'))
  const edge = page.locator('.react-flow__edge')
  await expect(edge).toHaveCount(1)
  await edge.locator('.react-flow__edge-textwrapper').click()
  await panel.getByLabel('Rejim').selectOption('async')
  await panel.getByLabel('Trafik').selectOption('read')
  await expect(edge.locator('path.react-flow__edge-path')).toHaveAttribute('style', /stroke-dasharray: 6,? 4/)
  await expect(edge.getByText('Oxuma', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('node-cache-1')).toContainText('Redis')
  await expect(page.getByTestId('node-cache-1')).toContainText('×3')
  await expect(page.locator('.react-flow__edge path.react-flow__edge-path')).toHaveAttribute('style', /stroke-dasharray/)
})

test('deletes, undoes and redoes on the canvas with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/sandbox')
  const palette = page.getByRole('navigation', { name: 'Komponentlər' })
  await palette.getByRole('button', { name: 'Load balancer: kətana əlavə et' }).click()
  await palette.getByRole('button', { name: 'Web server: kətana əlavə et' }).click()
  const loadBalancer = page.getByTestId('node-load-balancer-1')
  const webServer = page.getByTestId('node-web-server-1')
  await loadBalancer.locator('.react-flow__handle.source').dragTo(webServer.locator('.react-flow__handle.target'))
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)

  await loadBalancer.click()
  await page.keyboard.press('Delete')
  await expect(loadBalancer).toBeHidden()
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)

  await page.keyboard.press('Control+z')
  await expect(loadBalancer).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)

  await page.keyboard.press('Control+Shift+z')
  await expect(loadBalancer).toBeHidden()

  // The deletion is saved like any other change.
  await page.reload()
  await expect(webServer).toBeVisible()
  await expect(loadBalancer).toBeHidden()
})

test('shows the sandbox read-only with a notice on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/sandbox')
  await page.getByRole('button', { name: 'SQL database: kətana əlavə et' }).click()
  await expect(page.getByTestId('node-sql-database-1')).toBeVisible()

  await page.setViewportSize({ width: 375, height: 812 })

  await expect(page.getByRole('status')).toContainText('Kətan böyük ekranda daha yaxşı işləyir')
  await expect(page.getByRole('navigation', { name: 'Komponentlər' })).toBeHidden()
  await expect(page.getByTestId('node-sql-database-1')).toBeVisible()
  await page.getByTestId('node-sql-database-1').click()
  await expect(page.getByRole('region', { name: 'Tənzimləmə' }).getByLabel('Rol')).toBeDisabled()
})

test('solves the Pastebin high-level design Stage by drag and drop and receives a passing score', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1000 })
  await page.goto('/solutions/pastebin')
  await page.getByRole('link', { name: 'Çağırış kimi həll et' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pastebin.com (və ya Bit.ly) dizayn edin')

  // First feedback names no Rule: only the score and how many problems remain.
  await page.getByRole('button', { name: 'Yoxla' }).click()
  await expect(page.getByRole('status')).toContainText('Bal: 0 / 14 (0%)')
  await expect(page.getByRole('status')).toContainText('Qalan problem: 8')

  const palette = page.getByRole('navigation', { name: 'Komponentlər' })
  const canvas = page.getByTestId('rf__wrapper')
  const place: [string, number, number][] = [
    ['Client', 100, 230],
    ['Web server', 300, 230],
    ['Application service', 500, 80],
    ['Application service', 500, 230],
    ['Analytics / MapReduce', 500, 380],
    ['SQL database', 720, 80],
    ['Object store', 720, 300],
  ]
  for (const [component, x, y] of place) {
    await palette.getByRole('button', { name: `${component}: kətana əlavə et` }).dragTo(canvas, { targetPosition: { x, y } })
  }
  const connections = [
    ['client-1', 'web-server-1'],
    ['web-server-1', 'app-service-1'],
    ['web-server-1', 'app-service-2'],
    ['app-service-1', 'sql-database-1'],
    ['app-service-1', 'object-store-1'],
    ['app-service-2', 'sql-database-1'],
    ['app-service-2', 'object-store-1'],
    ['analytics-1', 'object-store-1'],
    ['analytics-1', 'sql-database-1'],
  ]
  for (const [source, target] of connections) {
    await page.getByTestId(`node-${source}`).locator('.react-flow__handle.source').dragTo(page.getByTestId(`node-${target}`).locator('.react-flow__handle.target'))
  }
  await expect(page.locator('.react-flow__edge')).toHaveCount(connections.length)

  await page.getByRole('button', { name: 'Yoxla' }).click()
  await expect(page.getByRole('status')).toContainText('Bal: 14 / 14 (100%)')
  await expect(page.getByRole('status')).toContainText('Bütün qaydalar ödənilir.')

  // Finishing shows every Rule's result and the Reference Solution beside the learner's Design.
  await page.getByRole('button', { name: 'Mərhələni bitir' }).click()
  await page.getByRole('button', { name: 'Bəli, bitir' }).click()
  await expect(page.getByText('✓ Ödənilir:')).toHaveCount(8)
  await expect(page.getByRole('application', { name: 'Referans həll' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Primer-in həllini oxuyun/ })).toHaveAttribute('href', '/solutions/pastebin#step-2-create-a-high-level-design')

  await page.reload()
  await expect(page.getByText('Mərhələ bitib.')).toBeVisible()
  await expect(page.getByText('Bal: 14 / 14 (100%)')).toBeVisible()
  await expect(page.getByRole('application', { name: 'Sizin dizaynınız' }).locator('.react-flow__node')).toHaveCount(place.length)
})
