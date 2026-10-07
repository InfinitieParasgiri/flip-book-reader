import assert from 'node:assert/strict';
const { chromium } = await import(process.env.BOOK_READER_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BOOK_READER_DEMO_URL);
  await page.waitForFunction(() => window.bookReader);
  await page.evaluate(async () => {
    window.bookReader.destroy();
    const { BookReader } = await import('/dist/index.js');
    window.calls = []; window.aborts = 0;
    const source = { pageCount: 100, size: { width: 600, height: 800 },
      async renderPage(index, container, { signal }) {
        window.calls.push(index);
        await new Promise((resolve, reject) => {
          const finish = () => { signal.removeEventListener('abort', abort); resolve(); };
          const timer = setTimeout(finish, index < 2 ? 10 : 1200);
          const abort = () => { clearTimeout(timer); window.aborts++; reject(new DOMException('Cancelled', 'AbortError')); };
          signal.addEventListener('abort', abort, { once: true });
        });
        signal.throwIfAborted(); container.textContent = `Actual page ${index}`;
      } };
    window.bookReader = new BookReader(document.querySelector('#reader'), source, {
      animationDuration: 250, onStateChange: state => { window.readerState = state; }
    });
  });
  await page.waitForFunction(() => document.querySelectorAll('.br-stage > .br-page[aria-busy=false]').length === 2);
  const start = await page.evaluate(() => { const start = performance.now(); void window.bookReader.next(); return start; });
  await page.waitForFunction(() => Number(document.querySelector('.br-fold')?.dataset.progress) > .1);
  assert.equal(await page.evaluate(() => window.readerState.page), 0);
  assert.match(await page.locator('.br-stage').innerText(), /Actual page 0/);
  await page.waitForFunction(() => window.readerState.page === 2 && !window.readerState.turning);
  const elapsed = await page.evaluate(start => performance.now() - start, start);
  assert.ok(elapsed < 900, `Turn waited for slow rendering: ${elapsed}ms`);
  assert.equal(await page.locator('.br-stage > .br-page[aria-busy=true]').count(), 2);
  await page.waitForFunction(() => document.querySelectorAll('.br-stage > .br-page[aria-busy=false]').length === 2);
  assert.match(await page.locator('.br-stage').innerText(), /Actual page 2/);
  assert.ok(await page.evaluate(() => Math.max(...window.calls)) <= 5, 'Reader preloaded the entire document');
  // Resize while holding a fold must remove the obsolete overlay and retain valid navigation.
  const rect = await page.locator('.br-stage').boundingBox();
  await page.mouse.move(rect.x + rect.width - 2, rect.y + 2); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * .8, rect.y + 30);
  await page.waitForFunction(() => document.querySelector('.br-fold'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.readerState.spread === 1 && !window.readerState.turning && !document.querySelector('.br-fold'));
  await page.mouse.up();
  await page.evaluate(() => { void window.bookReader.next(); window.bookReader.destroy(); });
  await page.waitForTimeout(1300); assert.equal(await page.locator('.br-reader').count(), 0);
  assert.deepEqual(errors, []);
  process.stdout.write(`Slow-source, bounded preload, resize and disposal checks passed; turn completed in ${Math.round(elapsed)}ms despite 1200ms rendering.\n`);
} finally { await browser.close(); }
