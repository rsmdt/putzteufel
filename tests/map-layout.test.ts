import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { type MapNode, arcAtPixel, fit, rectAt, squarify, sunburstArcs, sunburstGeometry, treemapRects } from '../src/tui/map/layout.ts';

const leaf = (key: string, size: number): MapNode => ({ key, label: key, size, color: '#336699', dim: false, children: [] });
const group = (key: string, children: MapNode[]): MapNode => ({ key, label: key, size: children.reduce((n, c) => n + c.size, 0), color: '#996633', dim: false, children });

const tree = group('root', [group('a', [leaf('a1', 60), leaf('a2', 20)]), group('b', [leaf('b1', 15), leaf('b2', 5)])]);

test('sunburst arcs split each ring by size', () => {
  const arcs = sunburstArcs(tree, 3);
  const ring1 = arcs.filter((a) => a.depth === 1);
  assert.deepEqual(ring1.map((a) => a.node.key), ['a', 'b']);
  assert.ok(Math.abs(ring1[1].end - Math.PI * 2) < 1e-9);
  assert.ok(Math.abs(ring1[0].end - Math.PI * 2 * 0.8) < 1e-9);
  const a1 = arcs.find((a) => a.node.key === 'a1')!;
  assert.equal(a1.depth, 2);
  assert.ok(Math.abs(a1.end - a1.start - Math.PI * 2 * 0.6) < 1e-9);
});

test('a pixel maps back to the arc under it', () => {
  const arcs = sunburstArcs(tree, 2);
  const g = sunburstGeometry(40, 20, 2);
  assert.equal(arcAtPixel(arcs, g, 20, 20), 'center');
  const right = arcAtPixel(arcs, g, 20 + Math.floor(g.hole + g.ring / 2), 20);
  assert.ok(right !== 'center' && right?.node.key === 'a');
  const outerLeft = arcAtPixel(arcs, g, 20 - Math.floor(g.hole + g.ring * 1.5), 19);
  assert.ok(outerLeft !== 'center' && outerLeft?.node.key === 'a2');
  const upperLeft = arcAtPixel(arcs, g, 10, 7);
  assert.ok(upperLeft !== 'center' && upperLeft?.node.key === 'b1');
  assert.equal(arcAtPixel(arcs, g, 0, 0), null);
});

test('squarify tiles the whole box without overlap', () => {
  const cells = squarify([6, 6, 4, 3, 2, 2, 1].map((value, item) => ({ value, item })), 0, 0, 60, 40);
  const area = cells.reduce((n, c) => n + c.w * c.h, 0);
  assert.ok(Math.abs(area - 2400) < 1e-6);
  for (const a of cells) for (const b of cells) {
    if (a === b) continue;
    const overlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    assert.ok(overlap < 1e-6);
  }
  assert.ok(Math.abs(cells[0].w * cells[0].h - 600) < 1e-6);
});

test('treemap nests children and hit-tests the deepest rect', () => {
  const rects = treemapRects(tree, 60, 30);
  const a = rects.find((r) => r.node.key === 'a')!;
  const a1 = rects.find((r) => r.node.key === 'a1')!;
  assert.equal(a1.depth, 2);
  assert.ok(a1.y >= a.y + 2);
  assert.equal(rectAt(rects, a1.x, a1.y)?.node.key, 'a1');
  assert.equal(rectAt(rects, a.x, a.y)?.node.key, 'a');
});

test('fit keeps both ends of long labels', () => {
  assert.equal(fit('short', 10), 'short');
  assert.equal(fit('/very/long/path/name', 9), '/ver…name');
  assert.equal(fit('abc', 0), '');
});
