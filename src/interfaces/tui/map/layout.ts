export interface MapNode {
  key: string;
  label: string;
  size: number;
  color: string;
  dim: boolean;
  children: MapNode[];
}

export interface Cell {
  ch: string;
  fg?: string;
  bg?: string;
}

export interface Run {
  text: string;
  fg?: string;
  bg?: string;
}

export interface Arc {
  node: MapNode;
  depth: number;
  start: number;
  end: number;
}

export interface Rect {
  node: MapNode;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

export const DEFAULT_HUES = [210, 28, 140, 280, 350, 180, 50, 100, 245, 320];

export interface MapGlyphs {
  top: string;
  bottom: string;
  edgeRight: string;
  edgeBottom: string;
}

export const BLOCK_GLYPHS: MapGlyphs = { top: '▀', bottom: '▄', edgeRight: '▏', edgeBottom: '▁' };
const MIN_ARC = 0.012;
const TAU = Math.PI * 2;

export function hsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(factor >= 0 ? c + (255 - c) * factor : c * (1 + factor));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`;
}

export function categoryColor(index: number, depth: number, sibling: number, hues = DEFAULT_HUES): string {
  return hsl(hues[index % hues.length], 0.55, Math.min(0.72, 0.42 + depth * 0.07 + (sibling % 4) * 0.04));
}

export function ancestry(root: MapNode, key: string): MapNode[] {
  if (root.key === key) return [root];
  for (const child of root.children) {
    const path = ancestry(child, key);
    if (path.length) return [root, ...path];
  }
  return [];
}

export function sunburstArcs(root: MapNode, maxDepth: number): Arc[] {
  const arcs: Arc[] = [];
  const visit = (node: MapNode, depth: number, start: number, end: number) => {
    if (depth > maxDepth || node.size <= 0) return;
    let angle = start;
    for (const child of node.children) {
      const span = ((end - start) * child.size) / node.size;
      if (span >= MIN_ARC) {
        arcs.push({ node: child, depth, start: angle, end: angle + span });
        visit(child, depth + 1, angle, angle + span);
      }
      angle += span;
    }
  };
  visit(root, 1, 0, TAU);
  return arcs;
}

export interface SunburstGeometry {
  cx: number;
  cy: number;
  hole: number;
  ring: number;
}

export function sunburstGeometry(width: number, height: number, maxDepth: number): SunburstGeometry {
  const radius = Math.max(2, Math.min(width / 2, height) - 0.5);
  const hole = radius * 0.32;
  return { cx: width / 2, cy: height, hole, ring: (radius - hole) / maxDepth };
}

export function arcAtPixel(arcs: Arc[], geometry: SunburstGeometry, px: number, py: number): Arc | 'center' | null {
  const dx = px + 0.5 - geometry.cx;
  const dy = py + 0.5 - geometry.cy;
  const r = Math.hypot(dx, dy);
  if (r < geometry.hole) return 'center';
  const depth = Math.floor((r - geometry.hole) / geometry.ring) + 1;
  const angle = (Math.atan2(dx, -dy) + TAU) % TAU;
  return arcs.find((a) => a.depth === depth && angle >= a.start && angle < a.end) ?? null;
}

function arcColor(arc: Arc, highlight: Set<string>, active: string | undefined): string {
  if (arc.node.key === active) return shade(arc.node.color, 0.55);
  if (highlight.has(arc.node.key)) return shade(arc.node.color, 0.25);
  return arc.node.dim ? shade(arc.node.color, -0.6) : arc.node.color;
}

export function renderSunburst(root: MapNode, width: number, height: number, active: string | undefined, centerLines: string[], maxDepth = 3, glyphs = BLOCK_GLYPHS): Cell[][] {
  const arcs = sunburstArcs(root, maxDepth);
  const geometry = sunburstGeometry(width, height, maxDepth);
  const highlight = new Set(active ? ancestry(root, active).map((n) => n.key) : []);
  const pixel = (x: number, y: number) => {
    const hit = arcAtPixel(arcs, geometry, x, y);
    return hit && hit !== 'center' ? arcColor(hit, highlight, active) : undefined;
  };
  const grid: Cell[][] = [];
  for (let row = 0; row < height; row++) {
    const line: Cell[] = [];
    for (let x = 0; x < width; x++) {
      const top = pixel(x, row * 2);
      const bottom = pixel(x, row * 2 + 1);
      if (top) line.push({ ch: glyphs.top, fg: top, bg: bottom });
      else if (bottom) line.push({ ch: glyphs.bottom, fg: bottom });
      else line.push({ ch: ' ' });
    }
    grid.push(line);
  }
  const holeWidth = Math.max(0, Math.floor(geometry.hole * 2) - 1);
  const first = Math.floor(height / 2) - Math.floor(centerLines.length / 2);
  centerLines.forEach((text, i) => {
    const row = grid[first + i];
    if (!row) return;
    const fitted = fit(text, holeWidth);
    const start = Math.floor(width / 2 - fitted.length / 2);
    [...fitted].forEach((ch, j) => {
      if (row[start + j]) row[start + j] = { ch, fg: i === 0 ? '#ffffff' : '#a0a0a0' };
    });
  });
  return grid;
}

function worst(row: number[], side: number): number {
  const total = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((side * side * max) / (total * total), (total * total) / (side * side * min));
}

export function squarify<T>(items: { value: number; item: T }[], x: number, y: number, w: number, h: number): { item: T; x: number; y: number; w: number; h: number }[] {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((n, i) => n + i.value, 0);
  if (!total || w <= 0 || h <= 0) return [];
  const scale = (w * h) / total;
  const out: { item: T; x: number; y: number; w: number; h: number }[] = [];
  let rest = positive.map((i) => ({ area: i.value * scale, item: i.item }));
  let box = { x, y, w, h };
  while (rest.length) {
    const side = Math.min(box.w, box.h);
    let row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]].map((r) => r.area), side) <= worst(row.map((r) => r.area), side)) row = [...row, rest[i++]];
    rest = rest.slice(i);
    const rowArea = row.reduce((n, r) => n + r.area, 0);
    const horizontal = box.w >= box.h;
    const thickness = rowArea / (horizontal ? box.h : box.w);
    let offset = 0;
    for (const r of row) {
      const length = r.area / thickness;
      out.push(horizontal ? { item: r.item, x: box.x, y: box.y + offset, w: thickness, h: length } : { item: r.item, x: box.x + offset, y: box.y, w: length, h: thickness });
      offset += length;
    }
    box = horizontal ? { x: box.x + thickness, y: box.y, w: box.w - thickness, h: box.h } : { x: box.x, y: box.y + thickness, w: box.w, h: box.h - thickness };
  }
  return out;
}

export function treemapRects(focus: MapNode, width: number, height: number, maxDepth = 2): Rect[] {
  const rects: Rect[] = [];
  const layout = (node: MapNode, x: number, y: number, w: number, h: number, depth: number) => {
    const cells = squarify(node.children.map((c) => ({ value: c.size, item: c })), x, y, w, h);
    for (const c of cells) {
      const rect = { node: c.item, x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.x + c.w) - Math.round(c.x), h: Math.round(c.y + c.h) - Math.round(c.y), depth };
      if (rect.w < 1 || rect.h < 1) continue;
      rects.push(rect);
      if (depth < maxDepth && rect.w >= 8 && rect.h >= 6 && c.item.children.length) layout(c.item, rect.x + 1, rect.y + 2, rect.w - 2, rect.h - 3, depth + 1);
    }
  };
  layout(focus, 0, 0, width, height, 1);
  return rects;
}

export function rectAt(rects: Rect[], x: number, y: number): Rect | null {
  let found: Rect | null = null;
  for (const r of rects) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && (!found || r.depth > found.depth)) found = r;
  return found;
}

export function renderTreemap(rects: Rect[], width: number, height: number, active: string | undefined, describe: (n: MapNode) => string, glyphs = BLOCK_GLYPHS): Cell[][] {
  const grid: Cell[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ ch: ' ' })));
  for (const r of rects) {
    const base = r.node.dim ? shade(r.node.color, -0.6) : r.node.color;
    const bg = r.node.key === active ? shade(base, 0.45) : base;
    const fg = r.node.dim ? '#c0c0c0' : '#101010';
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!grid[y]?.[x]) continue;
        const edge = x === r.x + r.w - 1 || y === r.y + r.h - 1;
        grid[y][x] = edge && r.w > 1 && r.h > 1 ? { ch: x === r.x + r.w - 1 ? glyphs.edgeRight : glyphs.edgeBottom, fg: shade(base, -0.5), bg } : { ch: ' ', bg };
      }
    }
    const labels = [fit(r.node.label, r.w - 2), fit(describe(r.node), r.w - 2)].slice(0, Math.max(0, r.h - 1));
    labels.forEach((text, i) => [...text].forEach((ch, j) => {
      const cell = grid[r.y + i]?.[r.x + j];
      if (cell) grid[r.y + i][r.x + j] = { ch, fg, bg: cell.bg };
    }));
  }
  return grid;
}

export function toRuns(row: Cell[]): Run[] {
  const runs: Run[] = [];
  for (const cell of row) {
    const last = runs[runs.length - 1];
    if (last && last.fg === cell.fg && last.bg === cell.bg) last.text += cell.ch;
    else runs.push({ text: cell.ch, fg: cell.fg, bg: cell.bg });
  }
  return runs;
}

export function fit(text: string, width: number): string {
  if (width <= 0) return '';
  if (text.length <= width) return text;
  if (width <= 1) return text.slice(0, width);
  const half = Math.floor((width - 1) / 2);
  return `${text.slice(0, width - 1 - half)}…${text.slice(text.length - half)}`;
}
