import assert from 'node:assert/strict';
const { chromium } = await import(process.env.BOOK_READER_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
 for (const rtl of [false, true]) {
  await page.goto(`${process.env.BOOK_READER_DEMO_URL}${rtl ? '?rtl=1' : ''}`);
  await page.waitForFunction(() => window.readerState?.spread === 2 && document.querySelectorAll('.br-stage > .br-page[aria-busy=false]').length === 2);
  for (const corner of ['top', 'bottom']) for (const forward of [true, false]) {
   const rect = await page.locator('.br-stage').boundingBox(), right = forward !== rtl;
   const x = right ? rect.x + rect.width + 6 : rect.x - 6, y = corner === 'top' ? rect.y - 6 : rect.y + rect.height + 6;
   await page.mouse.move(x, y); await page.mouse.down();
   await page.mouse.move(x + (right ? -1 : 1) * rect.width * .27, y + (corner === 'top' ? 1 : -1) * rect.height * .16, { steps: 8 });
   await page.waitForFunction(() => Number(document.querySelector('.br-fold')?.dataset.progress) > .15);
   assert.equal(await page.evaluate(() => getSelection().toString()), '');
   await page.mouse.up();
   await page.waitForFunction(target => window.readerState.page === target && !window.readerState.turning, forward ? 2 : 0);
   assert.equal(await page.locator('.br-fold').count(), 0);
  }
 }
 // Native multi-touch retains pinch zoom without accidentally turning a page.
 await page.setViewportSize({ width: 390, height: 844 });
 await page.waitForFunction(() => window.readerState.spread === 1);
 const rect = await page.locator('.br-stage').boundingBox(), session = await page.context().newCDPSession(page);
 const y = rect.y + rect.height / 2, x = rect.x + rect.width / 2;
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 25, y, id: 1 }, { x: x + 25, y, id: 2 }] });
 await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 45, y, id: 1 }, { x: x + 45, y, id: 2 }] });
 await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
 await page.waitForFunction(() => window.readerState.zoom > 1);
 assert.equal(await page.evaluate(() => window.readerState.page), 0);
 await page.evaluate(() => window.bookReader.destroy());
 process.stdout.write('Four directional corner folds, no drag text selection, and mobile pinch zoom passed.\n');
} finally { await browser.close(); }
