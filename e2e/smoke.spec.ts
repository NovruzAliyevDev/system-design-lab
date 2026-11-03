import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

/** How long a primer diagram may take to load from the dev server. */
const IMAGE_TIMEOUT = 15_000

test('opens the app and reads a Lesson', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Bu gün' })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Bütün dərslər' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dərslər' })).toBeVisible()

  await page.getByRole('main').getByRole('link', { name: 'Load balancer', exact: true }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Load balancer' })).toBeVisible()
  await expect(page.getByText('Load balancers distribute incoming client requests')).toBeVisible()
})

test("shows today's review, the streak, where to continue and the next topic on the Dashboard", async ({ page }) => {
  // A long Lesson, so its end is not in view and it stays unread until marked.
  await page.goto('/lessons/nosql')
  await page.getByRole('banner').getByRole('link', { name: 'System Design Lab' }).click()

  await expect(page.getByRole('region', { name: 'Bugünkü təkrar' })).toContainText('20 kart')
  const streak = page.getByRole('region', { name: 'Seriya' })
  await expect(streak).toContainText('0 gün')
  await expect(streak).toContainText('Bu gün: 0 / 2.')
  const resume = page.getByRole('region', { name: 'Qaldığınız yerdən davam edin' })
  await expect(resume).toContainText('NoSQL')
  await expect(page.getByRole('region', { name: 'Növbəti mövzu' }).getByRole('link', { name: /Bacarıq ağacında aç/ })).toBeVisible()

  // Reading the Lesson is one activity: with a minimum of one, today counts.
  await resume.getByRole('link', { name: /Dərsə davam edin/ }).click()
  await page.getByRole('button', { name: 'Oxunmuş kimi işarələ' }).click()
  await page.getByRole('banner').getByRole('link', { name: 'Tənzimləmələr' }).click()
  await page.getByRole('spinbutton', { name: 'Günün sayılması üçün ən az fəaliyyət' }).fill('1')
  await page.getByRole('banner').getByRole('link', { name: 'System Design Lab' }).click()

  await expect(streak).toContainText('1 gün')
  await expect(streak).toContainText('Bu gün seriyaya sayılıb.')
  await expect(resume.getByRole('link', { name: /Növbəti oxunmamış dərs/ })).toBeVisible()
})

test('moves through Lessons with the sidebar, primer links and next/previous', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/lessons/load-balancer')

  const toc = page.getByRole('navigation', { name: 'Mündəricat' })
  await expect(toc.getByRole('link', { name: 'Load balancer', exact: true })).toHaveAttribute('aria-current', 'page')

  const diagram = page.getByRole('article').locator('img').first()
  await expect(diagram).toBeVisible()
  // Visible means laid out, not loaded: wait for the image itself. A cold dev server on CI can take longer than 5 s.
  await expect.poll(() => diagram.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: IMAGE_TIMEOUT }).toBeGreaterThan(0)

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
  await expect(page.getByRole('heading', { level: 1, name: 'Bu gün' })).toBeVisible()
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

test('estimates from users with the calculator and compares two latencies, on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/lessons/back-of-the-envelope-calculations')
  await page.getByRole('link', { name: 'Back-of-the-envelope kalkulyatoru' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Kalkulyatorlar' })).toBeVisible()

  // It starts from the primer's Twitter usage: 100 million users post 5 tweets of 10 KB a day.
  await expect(page.getByText('Saniyədə yazma = ayda yazma ÷ ayda saniyə = 15 000 000 000 ÷ 2 500 000 = 6 000 sorğu/san')).toBeVisible()
  await expect(page.getByText('Ayda yeni məlumat = ayda yazma × bir yazmanın ölçüsü = 15 000 000 000 × 10 KB = 150 TB')).toBeVisible()
  const result = (quantity: string) => page.locator('dl > div').filter({ has: page.getByText(quantity, { exact: true }) })
  await expect(result('Saniyədə yazma')).toContainText('500 000 000 sorğu/gün')

  await page.getByRole('textbox', { name: 'Pik əmsalı' }).fill('3')
  await expect(result('Pikdə saniyədə yazma')).toContainText('18 000 sorğu/san')
  await page.getByRole('combobox', { name: 'Vahid: Bir yazmanın ölçüsü' }).selectOption('MB')
  await expect(result('Ayda yeni məlumat')).toContainText('150 PB')
  await page.getByRole('textbox', { name: 'Gündəlik aktiv istifadəçi' }).fill('çox')
  await expect(page.getByRole('alert')).toHaveText('Bütün sahələrə mənfi olmayan ədəd yazın.')

  // The latency comparison answers the primer's kind of question, or compares any two operations.
  await expect(page.getByText('15 dəfə')).toBeVisible()
  await page.getByRole('button', { name: 'Data mərkəzi daxilində bir round trip-ə neçə yaddaş müraciəti sığır?' }).click()
  await expect(page.getByText('5 000 dəfə')).toBeVisible()
  await page.getByRole('combobox', { name: 'Birinci əməliyyat' }).selectOption({ label: 'L1 cache reference (0.5 ns)' })
  await expect(page.getByText('200 dəfə')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
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
  await expect.poll(() => diagram.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: IMAGE_TIMEOUT }).toBeGreaterThan(0)

  // A link to a section of the primer on GitHub opens its Lesson in the app.
  await page.getByRole('article').getByRole('link', { name: 'system design topics', exact: true }).first().click()
  await expect(page).toHaveURL(/\/lessons\/index-of-system-design-topics$/)

  await page.getByRole('banner').getByRole('link', { name: 'Həllər' }).click()
  // Each Solution links to its page and to its Challenge.
  await expect(page.getByRole('main').getByRole('link', { name: 'Çağırış kimi həll et' })).toHaveCount(8)
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(16)
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
  // The quiz shows once progress has loaded, and reading the steps does not wait for it.
  await expect(ordering.getByRole('listitem')).toHaveCount(steps.length)
  for (const [target, step] of steps.entries()) {
    const texts = await ordering.getByRole('listitem').allInnerTexts()
    const current = texts.findIndex((text) => text.includes(step))
    for (let i = current; i > target; i--) await ordering.getByRole('button', { name: `Yuxarı: ${step}` }).click()
  }
  await expect(ordering.getByRole('listitem')).toContainText(steps)
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

  await addToCanvas(palette, canvas, 'Web server', 200, 150)
  await addToCanvas(palette, canvas, 'Cache', 550, 300)
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
  await expect(panel.getByLabel('Tutum (sorğu/san)')).toHaveValue('50000')

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

/** Drags with the mouse from the middle of `from` by an offset, for elements Playwright's `dragTo` cannot target. */
/**
 * Drags a palette component onto the canvas. The editor is no taller than the viewport, so it is first
 * scrolled to the viewport's bottom edge: a drag that has to scroll the page on the way drops nowhere.
 */
async function addToCanvas(palette: Locator, canvas: Locator, component: string, x: number, y: number) {
  await palette.evaluate((element) => element.scrollIntoView({ block: 'end' }))
  await palette.getByRole('button', { name: `${component}: kətana əlavə et` }).dragTo(canvas, { targetPosition: { x, y } })
}

async function dragBy(page: Page, from: Locator, dx: number, dy: number) {
  const box = (await from.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + dx / 2, start.y + dy / 2, { steps: 5 })
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 5 })
  await page.mouse.up()
}

test('groups Nodes in a zone box that carries them along, and exports the canvas as a PNG', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/sandbox')
  const palette = page.getByRole('navigation', { name: 'Komponentlər' })
  const canvas = page.getByTestId('rf__wrapper')
  const panel = page.getByRole('region', { name: 'Tənzimləmə' })
  await addToCanvas(palette, canvas, 'Cache', 650, 150)
  await addToCanvas(palette, canvas, 'Web server', 200, 150)
  const webServer = page.getByTestId('node-web-server-1')
  const cache = page.getByTestId('node-cache-1')

  // The web server is selected as it is added, so the new zone goes around it.
  await page.getByRole('button', { name: 'Zona əlavə et' }).click()
  const zone = page.getByTestId('zone-zone-1')
  await expect(zone).toBeVisible()
  await expect(panel.getByText('İçindəki komponentlər: 1')).toBeVisible()
  await panel.getByLabel('Ad').fill('us-east-1a')
  await expect(zone).toContainText('us-east-1a')

  // Widened by its corner, the zone reaches the cache's column; dragged into it, the cache joins.
  await dragBy(page, zone.locator('.react-flow__resize-control.handle.bottom.right'), 500, 150)
  await dragBy(page, cache, -100, 100)
  await zone.getByText('us-east-1a').click()
  await expect(panel.getByText('İçindəki komponentlər: 2')).toBeVisible()

  // Dragged by its header, the zone takes both along.
  const boxes = () => Promise.all([zone, webServer, cache].map(async (element) => (await element.boundingBox())!))
  const before = await boxes()
  await dragBy(page, zone.getByText('us-east-1a'), 0, 120)
  const [zoneMove, ...nodeMoves] = (await boxes()).map((box, i) => box.y - before[i].y)
  expect(zoneMove).toBeGreaterThan(60)
  for (const move of nodeMoves) expect(move).toBeCloseTo(zoneMove, 0)

  await page.reload()
  await page.getByTestId('zone-zone-1').getByText('us-east-1a').click()
  await expect(panel.getByText('İçindəki komponentlər: 2')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PNG kimi yüklə' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('dizayn.png')
  const bytes = readFileSync((await file.path())!)
  expect(bytes.subarray(1, 4).toString()).toBe('PNG')
})

test('selects several elements with Shift, copies and pastes them, and lays the Design out', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/sandbox')
  const palette = page.getByRole('navigation', { name: 'Komponentlər' })
  const panel = page.getByRole('region', { name: 'Tənzimləmə' })
  for (const component of ['Load balancer', 'Web server', 'Web server']) {
    await palette.getByRole('button', { name: `${component}: kətana əlavə et` }).click()
  }
  const node = (id: string) => page.getByTestId(`node-${id}`)
  await node('load-balancer-1').locator('.react-flow__handle.source').dragTo(node('web-server-1').locator('.react-flow__handle.target'))
  await node('load-balancer-1').locator('.react-flow__handle.source').dragTo(node('web-server-2').locator('.react-flow__handle.target'))
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)

  await node('load-balancer-1').click()
  await node('web-server-1').click({ modifiers: ['Shift'] })
  await expect(panel).toContainText('2 element seçilib')

  // The copy takes the Edge between the two along, but not the one to the Node left behind.
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(node('load-balancer-2')).toBeVisible()
  await expect(node('web-server-3')).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(3)

  // A Shift-drag over the empty canvas selects everything in the box.
  const canvasBox = (await page.getByTestId('rf__wrapper').boundingBox())!
  await page.keyboard.down('Shift')
  await page.mouse.move(canvasBox.x + 5, canvasBox.y + 5)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width - 5, canvasBox.y + canvasBox.height - 60, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(panel).toContainText(/\d+ element seçilib/)

  await page.getByRole('button', { name: 'Avtomatik düzən' }).click()
  // Requests flow left to right: each load balancer stands in a column before its web servers.
  await expect(async () => {
    const [balancer, first, second] = await Promise.all(['load-balancer-1', 'web-server-1', 'web-server-2'].map(async (id) => (await node(id).boundingBox())!))
    expect(balancer.x).toBeLessThan(first.x)
    expect(first.x).toBeCloseTo(second.x, 0)
    expect(Math.abs(first.y - second.y)).toBeGreaterThan(first.height)
  }).toPass()
})

test('explains each palette component with its Glossary Term, and draws the canvas sketched once chosen', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/sandbox')
  const palette = page.getByRole('navigation', { name: 'Komponentlər' })
  await palette.getByRole('button', { name: 'Load balancer: kətana əlavə et' }).hover()
  await expect(page.getByRole('tooltip')).toContainText('Load balancer')
  await expect(page.getByRole('tooltip')).toContainText('Gələn sorğuları bir neçə server arasında bölən komponent')
  await palette.getByRole('button', { name: 'Analytics / MapReduce: kətana əlavə et' }).hover()
  await expect(page.getByRole('tooltip')).toContainText('MapReduce')

  await palette.getByRole('button', { name: 'Load balancer: kətana əlavə et' }).click()
  await palette.getByRole('button', { name: 'Web server: kətana əlavə et' }).click()
  const balancer = page.getByTestId('node-load-balancer-1')
  await balancer.locator('.react-flow__handle.source').dragTo(page.getByTestId('node-web-server-1').locator('.react-flow__handle.target'))

  const sketchStyle = page.getByLabel('Əl ilə çəkilmiş üslub')
  await sketchStyle.check()
  const outline = balancer.locator('svg path')
  await expect(outline).toHaveCount(1)
  await expect(page.locator('.react-flow__edge path:not(.react-flow__edge-path):not(.react-flow__edge-interaction)')).not.toHaveCount(0)
  const darkStroke = await outline.evaluate((path) => getComputedStyle(path).stroke)

  // The choice is a setting: it stays after a reload, and the light theme keeps the sketch readable.
  await page.goto('/settings')
  await expect(page.getByLabel('Əl ilə çəkilmiş', { exact: true })).toBeChecked()
  await page.getByLabel('Açıq').check()
  await page.goto('/sandbox')
  await expect(page.getByLabel('Əl ilə çəkilmiş üslub')).toBeChecked()
  const lightStroke = await page.getByTestId('node-load-balancer-1').locator('svg path').evaluate((path) => getComputedStyle(path).stroke)
  expect(lightStroke).not.toBe(darkStroke)
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

/** Gives up the open Challenge Stage, then moves on to the next one. */
async function giveUpStage(page: Page, next: string) {
  await page.getByRole('button', { name: 'Təslim ol' }).click()
  await page.getByRole('button', { name: 'Bəli, cavabı göstər' }).click()
  await expect(page.getByText('Bu mərhələdə təslim oldunuz: 0 bal.')).toBeVisible()
  await page.getByRole('button', { name: `Növbəti mərhələ: ${next} →` }).click()
}

/** Finishes the open Challenge Stage after confirming. */
async function finishStage(page: Page) {
  await page.getByRole('button', { name: 'Mərhələni bitir' }).click()
  await page.getByRole('button', { name: 'Bəli, bitir' }).click()
}

test('solves the Pastebin high-level design Stage by drag and drop, then simulates it against the Scaling target and the Reference Solution', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1000 })
  await page.goto('/solutions/pastebin')
  await page.getByRole('link', { name: 'Çağırış kimi həll et' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pastebin.com (və ya Bit.ly) dizayn edin')

  // The high-level design opens once the Stages before it are over.
  await expect(page.getByRole('navigation', { name: 'Mərhələlər' }).getByRole('button', { name: '3. Yüksək səviyyəli dizayn' })).toBeDisabled()
  await giveUpStage(page, 'Hesablama')
  await giveUpStage(page, 'Yüksək səviyyəli dizayn')

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
    await addToCanvas(palette, canvas, component, x, y)
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
  await finishStage(page)
  await expect(page.getByText('Mərhələ balı: 100%')).toBeVisible()
  await expect(page.getByText('✓ Ödənilir:')).toHaveCount(8)
  await expect(page.getByRole('application', { name: 'Referans həll' })).toBeVisible()
  // The Solution page gives the later Stages away, so it waits for the end of the Attempt.
  await expect(page.getByRole('link', { name: /Primer-in həllini oxuyun/ })).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Mərhələ bitib.')).toBeVisible()
  await expect(page.getByText('Bal: 14 / 14 (100%)')).toBeVisible()
  await expect(page.getByRole('application', { name: 'Sizin dizaynınız' }).locator('.react-flow__node')).toHaveCount(place.length)

  // The Scaling Stage continues from this Design.
  await page.getByRole('button', { name: 'Növbəti mərhələ: Dərin təhlil →' }).click()
  await giveUpStage(page, 'Miqyaslama')
  await expect(page.getByText('Bu mərhələ yüksək səviyyəli dizaynınızla başlayır.')).toBeVisible()
  await expect(page.getByTestId('rf__wrapper').locator('.react-flow__node')).toHaveCount(place.length)
  await page.getByRole('button', { name: 'Yoxla' }).click()
  // The structural Rules it misses, the peak-load target (the single Web Server cannot take 1,100 requests a
  // second) and the Chaos task (it reads the shortlinks from the primary database).
  await expect(page.getByRole('status')).toContainText('Qalan problem: 9')
  await expect(page.getByRole('textbox', { name: 'Oxuma (sorğu/san)' })).toHaveValue('1000')
  await page.getByRole('button', { name: 'Simulyasiya et' }).click()
  await expect(page.getByTestId('node-web-server-1')).toHaveAttribute('data-overloaded', 'true')

  // Under the Stage's Chaos task, the primary database is down, and with it every read of this Design.
  const primaryDown = 'Tapşırıq: Link bazasının primary-si sıradan çıxıb: oxumalar xətasız işləməyə davam etməlidir.'
  await page.getByLabel('Ssenari', { exact: true }).selectOption({ label: primaryDown })
  await expect(page.getByTestId('node-sql-database-1')).toHaveAttribute('data-down', 'true')
  await expect(page.getByRole('region', { name: 'Nəticə' })).toContainText('Oxuma xətası100%')

  // Once the Stage is over, the Reference Solution is simulated beside the learner's Design under the same load.
  await page.getByRole('button', { name: 'Təslim ol' }).click()
  await page.getByRole('button', { name: 'Bəli, cavabı göstər' }).click()
  await page.getByRole('button', { name: 'Simulyasiya et' }).click()
  const yours = page.getByRole('region', { name: 'Sizin dizaynınızın nəticəsi' })
  const reference = page.getByRole('region', { name: 'Referans həllin nəticəsi' })
  await expect(yours).toContainText('Web server: 110% · Həddən artıq yüklənib')
  await expect(reference).toBeVisible()
  await expect(reference).not.toContainText('Həddən artıq yüklənib')
  await expect(page.getByRole('application', { name: 'Referans həll' }).getByTestId('node-web-server-1')).toHaveAttribute('data-overloaded', 'false')

  // ...and under the Chaos task too: the Reference keeps reading from its replicas.
  await page.getByLabel('Ssenari', { exact: true }).selectOption({ label: primaryDown })
  await expect(yours).toContainText('Oxuma xətası100%')
  await expect(reference).toContainText('Oxuma xətası0%')
  await expect(reference).toContainText('Yazma xətası100%')
  await expect(reference).toContainText('SQL Write Master-Slave: sıradan çıxıb')
})

test('runs the Pastebin Challenge Stage by Stage, scores the Attempt and retries from it', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1000 })
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Çağırışlar' }).click()
  await page.getByRole('link', { name: /Pastebin\.com \(və ya Bit\.ly\) dizayn edin/ }).click()

  // Requirements: two use cases in scope and one out of it make (2 − 1) / 12 of the Stage.
  await page.getByLabel('İstifadəçi mətn blokunu daxil edir və təsadüfi yaradılmış link alır').check()
  await page.getByLabel('İstifadəçi anonimdir').check()
  await page.getByLabel('İstifadəçi hesab yaradır və e-poçtunu təsdiqləyir').check()
  await page.getByRole('textbox', { name: 'Qeydlər' }).fill('Hesab yoxdur.')
  await finishStage(page)
  await expect(page.getByText('Mərhələ balı: 8%')).toBeVisible()
  await expect(page.getByText('seçilməməli idi')).toHaveCount(1)
  await page.getByRole('button', { name: 'Növbəti mərhələ: Hesablama →' }).click()

  // Estimation: answers within a factor of 2 of the reference pass, whatever unit they are given in.
  // The calculators open in a new tab, beside the Stage.
  await expect(page.getByRole('link', { name: 'Back-of-the-envelope kalkulyatoru' })).toHaveAttribute('target', '_blank')
  await page.getByRole('textbox', { name: 'Orta hesabla saniyədə neçə paste yazılır?' }).fill('4')
  await page.getByRole('textbox', { name: 'Orta hesabla saniyədə neçə oxuma sorğusu gəlir?' }).fill('30')
  await page.getByRole('textbox', { name: 'Bir ildə nə qədər yeni paste məlumatı yığılır?' }).fill('150')
  await page.getByRole('combobox', { name: 'Vahid: Bir ildə nə qədər yeni paste məlumatı yığılır?' }).selectOption('GB')
  await page.getByRole('textbox', { name: '3 ildə nə qədər paste məlumatı yığılır?' }).fill('1,2')
  await page.getByRole('combobox', { name: 'Vahid: 3 ildə nə qədər paste məlumatı yığılır?' }).selectOption('TB')
  await finishStage(page)
  await expect(page.getByText('Mərhələ balı: 60%')).toBeVisible()
  await expect(page.getByText('Referans: 457,6 GB')).toBeVisible()
  await expect(page.getByText('Saniyədə yazma = ayda yazma ÷ ayda saniyə = 10 000 000 ÷ 2 500 000 = 4 sorğu/san')).toBeVisible()
  await page.getByRole('button', { name: 'Növbəti mərhələ: Yüksək səviyyəli dizayn →' }).click()

  await giveUpStage(page, 'Dərin təhlil')
  await page.getByLabel('Amazon S3 kimi idarə olunan Object Store-da, bazada isə yalnız paste_path').check()
  await finishStage(page)
  await expect(page.getByText('Mərhələ balı: 14%')).toBeVisible()
  await expect(page.getByText('Base 64-ün + və / simvolları url-də escape tələb edir')).toBeVisible()
  await page.getByRole('button', { name: 'Növbəti mərhələ: Miqyaslama →' }).click()
  await page.getByRole('button', { name: 'Təslim ol' }).click()
  await page.getByRole('button', { name: 'Bəli, cavabı göstər' }).click()

  // (1 × 1/12 + 1 × 3/5 + 3 × 0 + 2 × 1/7 + 3 × 0) / 10
  await expect(page.getByRole('region', { name: 'Cəhdin nəticəsi' })).toContainText('Çağırış balı: 10%')
  await expect(page.getByRole('link', { name: /Primer-in həllini oxuyun/ })).toHaveAttribute('href', '/solutions/pastebin#step-4-scale-the-design')
  await page.reload()
  const history = page.getByRole('region', { name: 'Cəhdlər' })
  await expect(history).toContainText('Cəhd 1')
  await expect(history).toContainText('Çağırış balı: 10%')

  // A retry from the last Attempt starts from its answers, with every Stage open again.
  await history.getByRole('button', { name: 'Son cəhddən davam et' }).click()
  await expect(page.getByRole('heading', { level: 2, name: '1. Tələblər' })).toBeVisible()
  await expect(page.getByLabel('İstifadəçi anonimdir')).toBeChecked()
  await expect(page.getByRole('textbox', { name: 'Qeydlər' })).toHaveValue('Hesab yoxdur.')
  await expect(page.getByRole('navigation', { name: 'Mərhələlər' }).getByRole('button', { name: '2. Hesablama' })).toBeDisabled()
  await expect(history.getByRole('listitem')).toHaveCount(2)
  await expect(history.getByRole('listitem').first()).toContainText('Cəhd 2')
  await expect(history.getByRole('listitem').first()).toContainText('davam edir')

  // An earlier Attempt shows read-only.
  await history.getByRole('button', { name: 'Bax' }).click()
  await expect(page.getByText('Cəhd 1 göstərilir.')).toBeVisible()
  await page.getByRole('navigation', { name: 'Mərhələlər' }).getByRole('button', { name: /^1\. Tələblər/ }).click()
  await expect(page.getByLabel('İstifadəçi anonimdir')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Mərhələni bitir' })).toHaveCount(0)

  // Challenges are found by search too.
  await page.getByRole('button', { name: 'Axtar' }).click()
  const search = page.getByRole('dialog', { name: 'Axtar' })
  await search.getByRole('combobox', { name: 'Axtar' }).fill('pastebin')
  // Other Challenges that mention Pastebin are found too; the Pastebin Challenge comes first.
  await expect(search.getByRole('option').filter({ hasText: 'Çağırış' }).first()).toContainText('Pastebin.com (və ya Bit.ly) dizayn edin')
})

test('runs a Mock Interview against the clock without Hints, self-assesses it and tells it apart in the history', async ({ page }) => {
  // The clock stands still unless the test moves it.
  await page.clock.install({ time: new Date('2026-10-30T08:59:00Z') })
  await page.clock.pauseAt(new Date('2026-10-30T09:00:00Z'))
  await page.setViewportSize({ width: 1366, height: 1000 })
  await page.goto('/challenges/pastebin')

  // The time boxes follow the interview's length: 30 minutes are shared out as 3, 3, 10, 7 and 7.
  await page.getByText('Müsahibə simulyasiyası', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Ümumi vaxt (dəqiqə)' }).fill('30')
  await expect(page.getByRole('textbox', { name: 'Tələblər (dəqiqə)' })).toHaveValue('3')
  await expect(page.getByRole('textbox', { name: 'Miqyaslama (dəqiqə)' })).toHaveValue('7')
  await page.getByRole('button', { name: 'Müsahibəyə başla' }).click()

  const timer = page.getByRole('timer', { name: 'Müsahibə vaxtı' })
  await expect(timer).toContainText('Qalan vaxt: 30:00')
  await expect(page.getByRole('navigation', { name: 'Mərhələlər' })).toContainText('1. Tələblər3 dəq')

  // A time box shows when it is overrun but blocks nothing, and the clock carries on across a reload.
  await page.clock.fastForward('03:30')
  await expect(timer).toContainText('Tələblər: 3:30 / 3:00')
  await page.reload()
  await expect(timer).toContainText('Qalan vaxt: 26:30')

  await giveUpStage(page, 'Hesablama')
  await giveUpStage(page, 'Yüksək səviyyəli dizayn')
  await page.getByRole('button', { name: 'Yoxla' }).click()
  await expect(page.getByRole('status')).toContainText('Qalan problem: 8')
  await expect(page.getByText('Müsahibə simulyasiyasında ipucu yoxdur: problemləri özünüz tapın.')).toBeVisible()
  await expect(page.getByRole('button', { name: /İpucu aç/ })).toHaveCount(0)

  await giveUpStage(page, 'Dərin təhlil')
  await giveUpStage(page, 'Miqyaslama')
  await page.getByRole('button', { name: 'Təslim ol' }).click()
  await page.getByRole('button', { name: 'Bəli, cavabı göstər' }).click()
  await expect(timer).toHaveCount(0)

  // The end screen: the automatic scores, the times, and the rubric to fill in.
  const summary = page.getByRole('region', { name: /Cəhdin nəticəsi/ })
  await expect(summary).toContainText('Çağırış balı: 0%')
  await expect(summary).toContainText('Müsahibə 3:30 çəkdi (30 dəqiqədən).')
  const save = page.getByRole('button', { name: 'Qiymətləndirməni saxla' })
  await expect(save).toBeDisabled()
  // A new Attempt would leave the interview unassessed for good, so it asks first.
  await page.getByRole('button', { name: 'Sıfırdan yenidən başla' }).click()
  await expect(page.getByText('Son müsahibəni hələ qiymətləndirməmisiniz; yeni cəhd başlasa, onu qiymətləndirmək olmayacaq.')).toBeVisible()
  await page.getByRole('button', { name: 'Ləğv et' }).click()
  const ratings: [string, string][] = [
    ['Ünsiyyət', '4 · Yaxşı'],
    ['Tələbləri dəqiqləşdirmə', '3 · Orta'],
    ['Hesablama', '5 · Əla'],
    ['Dizayn', '4 · Yaxşı'],
    ['Trade-off-lar', '2 · Kifayət deyil'],
    ['Miqyaslama', '3 · Orta'],
  ]
  for (const [criterion, level] of ratings) {
    await page.getByRole('group', { name: new RegExp(`^${criterion} ·`) }).getByText(level).click()
  }
  await page.getByRole('textbox', { name: 'Qeydlər' }).fill('Hesablamada tələsdim.')
  await save.click()
  await expect(page.getByText('Saxlanıldı: 30.10.2026')).toBeVisible()

  // A practice Attempt after it: the history tells the two modes apart.
  await page.getByRole('button', { name: 'Sıfırdan yenidən başla' }).click()
  const history = page.getByRole('region', { name: 'Cəhdlər' }).getByRole('listitem')
  await expect(history.nth(0)).toContainText('Cəhd 2Məşq')
  await expect(history.nth(1)).toContainText('Cəhd 1Müsahibə simulyasiyası')
  await expect(history.nth(1)).toContainText('özünüqiymətləndirmə: 3,5 / 5')

  // The interview opens read-only, with its self-assessment.
  await history.nth(1).getByRole('button', { name: 'Bax' }).click()
  await expect(page.getByRole('group', { name: /^Hesablama ·/ }).getByRole('radio', { name: '5 · Əla' })).toBeChecked()
  await expect(page.getByRole('textbox', { name: 'Qeydlər' })).toBeDisabled()
})

test('simulates traffic on an undersized sandbox Design, flags the overloaded Node and clears it once scaled out', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1000 })
  await page.goto('/sandbox')
  const palette = page.getByRole('navigation', { name: 'Komponentlər' })
  const canvas = page.getByTestId('rf__wrapper')
  await addToCanvas(palette, canvas, 'Client', 120, 150)
  await addToCanvas(palette, canvas, 'Web server', 520, 150)
  const client = page.getByTestId('node-client-1')
  const webServer = page.getByTestId('node-web-server-1')
  await client.locator('.react-flow__handle.source').dragTo(webServer.locator('.react-flow__handle.target'))
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)

  // One web server serves 1,000 requests a second; 1,500 overload it.
  await page.getByLabel('Oxuma (sorğu/san)').fill('1400')
  await page.getByLabel('Yazma (sorğu/san)').fill('100')
  await page.getByRole('button', { name: 'Simulyasiya et' }).click()
  await expect(webServer).toHaveAttribute('data-overloaded', 'true')
  await expect(webServer).toContainText('1 500 / 1 000 sorğu/san · 150%')
  await expect(webServer).toContainText('Həddən artıq yüklənib')
  await expect(client).toContainText('1 500 sorğu/san göndərir')
  await expect(page.locator('.react-flow__edge.animated')).toHaveCount(1)
  const summary = page.getByRole('region', { name: 'Nəticə' })
  await expect(summary).toContainText('Xəta nisbəti33,3%')
  await expect(summary).toContainText('Atılan sorğular500 sorğu/san')
  await expect(summary).toContainText('Web server: 150% · Həddən artıq yüklənib')

  // The results follow the Design: two instances carry the load.
  await webServer.click()
  await page.getByRole('region', { name: 'Tənzimləmə' }).getByLabel('Nüsxə sayı').fill('2')
  await expect(webServer).toHaveAttribute('data-overloaded', 'false')
  await expect(summary).toContainText('Xəta nisbəti0%')
  await expect(summary).toContainText('Aylıq xərc140 $')

  // ...and the load: at 100,000 requests a second it breaks again.
  await page.getByRole('slider', { name: 'Ümumi yük' }).fill('5')
  await expect(page.getByText('Ümumi yük: 100 000 sorğu/san')).toBeVisible()
  await expect(webServer).toHaveAttribute('data-overloaded', 'true')

  await page.getByRole('button', { name: 'Simulyasiyanı dayandır' }).click()
  await expect(summary).toHaveCount(0)
  await expect(webServer).not.toHaveAttribute('data-overloaded')
})

test('breaks a sandbox Design with Chaos Scenarios: a load balancer fails over, and the failing requests show', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1000 })
  await page.goto('/sandbox')
  const palette = page.getByRole('navigation', { name: 'Komponentlər' })
  const canvas = page.getByTestId('rf__wrapper')
  await addToCanvas(palette, canvas, 'Client', 100, 200)
  await addToCanvas(palette, canvas, 'Load balancer', 330, 200)
  await addToCanvas(palette, canvas, 'Web server', 580, 100)
  await addToCanvas(palette, canvas, 'Web server', 580, 320)
  const connect = (source: string, target: string) =>
    page.getByTestId(`node-${source}`).locator('.react-flow__handle.source').dragTo(page.getByTestId(`node-${target}`).locator('.react-flow__handle.target'))
  await connect('client-1', 'load-balancer-1')
  await connect('load-balancer-1', 'web-server-1')
  await connect('load-balancer-1', 'web-server-2')
  await expect(page.locator('.react-flow__edge')).toHaveCount(3)

  await page.getByLabel('Oxuma (sorğu/san)').fill('800')
  await page.getByLabel('Yazma (sorğu/san)').fill('0')
  await page.getByRole('button', { name: 'Simulyasiya et' }).click()
  const summary = page.getByRole('region', { name: 'Nəticə' })
  const chaos = page.getByRole('region', { name: 'Xaos ssenarisi' })

  // One web server down: the load balancer sends all 800 reads to the other, which carries them.
  await chaos.getByLabel('Ssenari', { exact: true }).selectOption({ label: 'Node sıradan çıxır' })
  await chaos.getByLabel('Web server 2').check()
  await expect(page.getByTestId('node-web-server-2')).toHaveAttribute('data-down', 'true')
  await expect(page.getByTestId('node-web-server-2')).toContainText('Sıradan çıxıb')
  await expect(page.getByTestId('node-web-server-1')).toContainText('800 / 1 000 sorğu/san · 80%')
  await expect(summary).toContainText('Sınan hissələrWeb server 2: sıradan çıxıb')
  await expect(summary).toContainText('Xəta nisbəti0%')

  // Both down: every request fails, along the paths listed as failing.
  await chaos.getByLabel('Web server', { exact: true }).check()
  await expect(summary).toContainText('Xəta nisbəti100%')
  await expect(summary).toContainText('Xəta verən yollar')
  await expect(page.locator('.react-flow__edge.animated')).toHaveCount(1)

  // A partition between the load balancer and one web server: the load balancer reaches only the other.
  await chaos.getByLabel('Ssenari', { exact: true }).selectOption({ label: 'Şəbəkə bölünür (partition)' })
  await chaos.getByLabel('Load balancer: tərəf').selectOption({ label: 'A tərəfi' })
  await chaos.getByLabel('Web server: tərəf').selectOption({ label: 'B tərəfi' })
  await expect(summary).toContainText('Load balancer → Web server: kəsilib')
  await expect(page.getByTestId('node-web-server-2')).toContainText('800 / 1 000 sorğu/san · 80%')
  await expect(summary).toContainText('Xəta nisbəti0%')

  // No scenario: everything works again.
  await chaos.getByLabel('Ssenari', { exact: true }).selectOption({ label: 'Yoxdur: hər şey işləyir' })
  await expect(summary).not.toContainText('Sınan hissələr')
  await expect(page.getByTestId('node-web-server-1')).toContainText('400 / 1 000 sorğu/san · 40%')
})
