import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdfSource } from '../dist/sources/pdf.js';

test('PDF adapter reads real count and dimensions and destroys once', async () => {
  let calls = 0;
  const task = { promise: Promise.resolve({ numPages: 32, getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }), cleanup: () => true }) }), destroy: async () => { calls++; } };
  const source = await createPdfSource(task);
  assert.equal(source.pageCount, 32); assert.equal(source.size.width, 600);
  await source.destroy(); await source.destroy(); assert.equal(calls, 1);
});
test('aborted PDF initialization disposes its loading task', async () => {
  let calls = 0; const controller = new AbortController(); controller.abort();
  const task = { promise: Promise.resolve({}), destroy: async () => { calls++; } };
  await assert.rejects(createPdfSource(task, controller.signal), { name: 'AbortError' }); assert.equal(calls, 1);
});
test('invalid or failed PDF documents dispose the worker task', async () => {
  let calls = 0;
  await assert.rejects(createPdfSource({ promise: Promise.reject(new Error('Invalid PDF')), destroy: async () => { calls++; } }));
  assert.equal(calls, 1);
});
