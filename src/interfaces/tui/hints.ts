export type HintPriority = 'essential' | 'normal' | 'optional';

export interface Hint {
  key: string;
  label: string;
  priority: HintPriority;
}

export interface FittedHint {
  key: string;
  label: string;
}

export interface FittedHints {
  hints: FittedHint[];
  truncated: boolean;
}

export const HINT_SEPARATOR = ' · ';

const RANK: Record<HintPriority, number> = { optional: 0, normal: 1, essential: 2 };

function hintWidth(h: FittedHint): number {
  return h.key.length + (h.label ? 1 + h.label.length : 0);
}

export function hintsWidth(hints: FittedHint[]): number {
  return hints.reduce((n, h) => n + hintWidth(h), 0) + Math.max(0, hints.length - 1) * HINT_SEPARATOR.length;
}

export function shortenModifiers(key: string): string {
  return key.replace(/ctrl\+/g, '^').replace(/alt\+/g, 'M-').replace(/shift\+/g, 'S-');
}

export function fitHints(all: Hint[], width: number): FittedHints {
  if (hintsWidth(all) <= width) return { hints: all.map(({ key, label }) => ({ key, label })), truncated: false };
  const short = all.map((h) => ({ ...h, key: shortenModifiers(h.key) }));
  if (hintsWidth(short) <= width) return { hints: short.map(({ key, label }) => ({ key, label })), truncated: false };

  const kept = new Set(short.map((_, i) => i));
  const dropOrder = short
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.priority !== 'essential' && h.key !== 'esc')
    .sort((a, b) => RANK[a.h.priority] - RANK[b.h.priority] || b.i - a.i)
    .map(({ i }) => i);
  const current = () => short.filter((_, i) => kept.has(i));
  const dropped: number[] = [];
  for (const i of dropOrder) {
    if (hintsWidth(current()) <= width) break;
    kept.delete(i);
    dropped.push(i);
  }
  if (hintsWidth(current()) <= width) {
    for (const i of [...dropped].reverse()) {
      kept.add(i);
      if (hintsWidth(current()) > width) kept.delete(i);
    }
    return { hints: current().map(({ key, label }) => ({ key, label })), truncated: false };
  }

  const bare = current().map(({ key, label }) => ({ key, label }));
  for (let i = bare.length - 1; i >= 0 && hintsWidth(bare) > width; i--) bare[i] = { key: bare[i].key, label: '' };
  if (hintsWidth(bare) <= width) return { hints: bare, truncated: false };

  while (bare.length && hintsWidth(bare) + HINT_SEPARATOR.length + 1 > width) bare.pop();
  return { hints: bare, truncated: true };
}
