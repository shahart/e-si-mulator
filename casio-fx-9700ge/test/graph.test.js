import assert from 'node:assert/strict';
import test from 'node:test';
import { projectPoint } from '../dist/graph.js';

const view = { xMin: -2, xMax: 1, xScale: 1, yMin: -1.2, yMax: 1.2, yScale: 1 };

test('projects view-window coordinates onto canvas pixels', () => {
  assert.deepEqual(projectPoint(view, -2, 1.2, 128, 64), { x: 0, y: 0, visible: true });
  assert.deepEqual(projectPoint(view, 1, -1.2, 128, 64), { x: 127, y: 63, visible: true });
  assert.deepEqual(projectPoint(view, 0, 0, 128, 64), { x: 85, y: 32, visible: true });
});

test('marks points outside the view window as hidden', () => {
  assert.equal(projectPoint(view, 2, 0, 128, 64).visible, false);
  assert.equal(projectPoint(view, 0, -2, 128, 64).visible, false);
  assert.equal(projectPoint(view, Number.NaN, 0, 128, 64).visible, false);
});
