import assert from 'node:assert/strict';
const { chromium } = await import(process.env.BOOK_READER_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.BOOK_READER_DEMO_URL;
if (!base) throw new Error('Set BOOK_READER_DEMO_URL to the running demo');
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await page.waitForFunction(() => window.readerState?.spread === 2 && document.querySelectorAll('.br-page[aria-busy=false]').length === 2);
  const button = name => page.getByRole('button', { name, exact: true });
  await button('Next page').click(); await page.waitForFunction(() => document.querySelector('.br-sheet'));
  assert.equal(await page.locator('.br-sheet-face').count(), 2);
  await page.waitForFunction(() => window.readerState.page === 2 && !window.readerState.turning);
  await button('Previous page').click(); await page.waitForFunction(() => window.readerState.page === 0 && !window.readerState.turning);
  await button('Zoom in').click(); await page.waitForFunction(() => window.readerState.zoom === 1.25);
  await button('Page thumbnails').click(); await page.waitForFunction(() => document.querySelector('.br-thumbnails canvas, .br-thumbnails .br-html-page'));
  assert.ok(await page.locator('.br-thumbnails button').count() <= 24);
  await button('Page thumbnails').click(); await button('Fit to screen').click();
  await button('Start automatic page turning').click(); await page.waitForFunction(() => window.readerState.page >= 2);
  await button('Pause automatic page turning').click();
  await page.evaluate(() => { window.bookReader.destroy(); }); assert.equal(await page.locator('.br-reader').count(), 0);
  await page.goto(`${base}?source=images`); await page.waitForFunction(() => document.querySelectorAll('.br-page img').length === 2);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => window.readerState.spread === 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('.br-viewport').focus(); await page.keyboard.press('ArrowRight'); await page.waitForFunction(() => window.readerState.page === 1 && !window.readerState.turning);
  await page.goto(`${base}?rtl=1`); await page.waitForFunction(() => window.readerState?.spread === 1);
  await page.locator('.br-viewport').focus(); await page.keyboard.press('ArrowLeft'); await page.waitForFunction(() => window.readerState.page === 1 && !window.readerState.turning);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.keyboard.press('End'); await page.waitForFunction(() => window.readerState.page === 8 && !window.readerState.turning);
  await button('Start automatic page turning').click(); assert.equal(await page.evaluate(() => window.readerState.autoplay), false);
  await page.emulateMedia({ colorScheme: 'dark' }); assert.equal(await page.locator('.br-reader').evaluate(node => getComputedStyle(node).colorScheme), 'light dark');
  if (process.env.BOOK_READER_TEST_PDF) {
    await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(`${base}?source=pdf`);
    await page.waitForFunction(() => window.readerState?.pageCount > 1 && document.querySelectorAll('.br-page canvas').length === 2, { timeout: 30000 });
    const count = await page.evaluate(() => window.readerState.pageCount); assert.ok(count > 1);
    await button('Next page').click(); await page.waitForFunction(() => window.readerState.page === 2 && !window.readerState.turning);
    await button('Zoom in').click(); await page.waitForTimeout(250);
    assert.ok(await page.locator('.br-page canvas').first().evaluate(canvas => canvas.width > 0));
    await page.evaluate(async () => { window.bookReader.destroy(); await window.bookSource.destroy(); });
  }
  assert.deepEqual(errors, []); process.stdout.write('Browser checks passed: animation, navigation, zoom, timer, thumbnails, mobile, RTL, reduced motion, disposal and optional PDF.\n');
} finally { await browser.close(); }
