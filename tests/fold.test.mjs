import test from 'node:test';
import assert from 'node:assert/strict';
import { foldGeometry, transformPoint } from '../dist/core/foldGeometry.js';
const area = polygon => Math.abs(polygon.reduce((sum, a, index) => {
  const b = polygon[(index + 1) % polygon.length]; return sum + a.x * b.y - a.y * b.x;
}, 0) / 2);

test('fold reflection maps the real corner to the constrained pointer', () => {
  for (const corner of ['top', 'bottom']) for (const pointer of [{ x: 450, y: 70 }, { x: 250, y: 150 }, { x: -500, y: 0 }, { x: 200, y: 900 }]) {
    const result = foldGeometry(500, 700, corner, pointer);
    const reflected = transformPoint(result.matrix, { x: 500, y: corner === 'top' ? 0 : 700 });
    assert.ok(Math.abs(reflected.x - result.point.x) < 1e-6 && Math.abs(reflected.y - result.point.y) < 1e-6);
    assert.ok(result.progress >= 0 && result.progress <= 1);
  }
});
test('fold clips partition the page without holes or overlapping areas', () => {
  for (const corner of ['top', 'bottom']) for (let x = -500; x <= 500; x += 50) for (const y of [-200, 0, 100, 350, 700, 900]) {
    const result = foldGeometry(500, 700, corner, { x, y });
    assert.ok(Math.abs(area(result.front) + area(result.back) - 350000) < .001);
    assert.ok([...result.matrix, result.shadowAngle, result.shadowStop].every(Number.isFinite));
  }
});
test('completed fold occupies the opposite page and restores readable orientation', () => {
  const result = foldGeometry(500, 700, 'bottom', { x: -500, y: 700 });
  assert.equal(result.progress, 1); assert.equal(area(result.front), 0); assert.equal(area(result.back), 350000);
  const backCorner = transformPoint(result.matrix, { x: 500, y: 0 });
  assert.deepEqual(backCorner, { x: -500, y: 0 });
});
