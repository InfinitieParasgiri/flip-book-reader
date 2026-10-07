import test from 'node:test';
import assert from 'node:assert/strict';
import { spreadStart, visiblePages, fitPages, clampZoom, intervalMilliseconds, validateSource, safeLink, formatLabel } from '../dist/core/model.js';
import { AutoTurn } from '../dist/core/AutoTurn.js';

test('spreads clamp to existing pages and preserve an odd last page', () => {
  assert.equal(spreadStart(4, 5, 2), 4);
  assert.deepEqual(visiblePages(4, 5, 2), [4]);
  assert.deepEqual(visiblePages(3, 5, 2), [2, 3]);
  assert.deepEqual(visiblePages(-10, 5, 1), [0]);
  assert.equal(spreadStart(NaN, 5, 2), 0);
});
test('layout fits both spread dimensions and zoom is bounded', () => {
  const size = fitPages(1000, 600, { width: 600, height: 800 }, 2);
  assert.ok(size.width * 2 <= 968 && size.height <= 568);
  assert.equal(clampZoom(99), 3); assert.equal(clampZoom(NaN), 1); assert.equal(clampZoom(.5), 1);
});
test('invalid sources, timers and executable URLs are rejected', () => {
  for (const count of [0, -1, NaN, 100001, 1.5]) assert.throws(() => validateSource(count, { width: 1, height: 1 }));
  assert.throws(() => validateSource(1, { width: 0, height: 1 }));
  assert.throws(() => intervalMilliseconds(0)); assert.equal(intervalMilliseconds(60), 60000);
  assert.throws(() => safeLink('javascript:alert(1)')); assert.throws(() => safeLink('data:text/html,x'));
  assert.equal(safeLink('https://example.org/book.pdf'), 'https://example.org/book.pdf');
  assert.equal(formatLabel('Page {page} / {unknown}', { page: 2 }), 'Page 2 / {unknown}');
});
test('auto turn pauses, resets after interaction, stops at end, and destroys timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let allowed = true, page = 0;
  const auto = new AutoTurn(1, () => allowed, () => page >= 2, async () => { page++; }, () => {});
  auto.setEnabled(true); t.mock.timers.tick(900); assert.equal(page, 0);
  allowed = false; auto.reset(); t.mock.timers.tick(5000); assert.equal(page, 0);
  allowed = true; auto.reset(); t.mock.timers.tick(1000); await Promise.resolve();
  assert.equal(page, 1); t.mock.timers.tick(1000); await Promise.resolve(); assert.equal(page, 2);
  assert.equal(auto.enabled, false);
  auto.destroy(); t.mock.timers.tick(10000); assert.equal(page, 2);
});
test('core imports without React or browser globals', async () => {
  const core = await import('../dist/index.js'); assert.equal(typeof core.BookReader, 'function');
});
test('blank or missing translations fall back to the canonical English labels', async () => {
  const { readerLabels } = await import('../dist/core/labels.js');
  assert.equal(readerLabels({ next: '', previous: undefined }).next, 'Next page');
  assert.equal(readerLabels({ next: 'Translated next' }).next, 'Translated next');
  const { readFile } = await import('node:fs/promises');
  const english = JSON.parse(await readFile(new URL('../src/locales/en.json', import.meta.url), 'utf8'));
  assert.deepEqual(readerLabels(), english);
});
