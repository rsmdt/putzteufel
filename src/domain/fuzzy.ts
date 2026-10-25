interface FuzzyMatch {
  score: number;
  positions: number[];
}

const BOUNDARY = /[\s/\\_\-.:~]/;

export function fuzzyMatch(text: string, query: string): FuzzyMatch | null {
  if (!query) return { score: 0, positions: [] };
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const positions: number[] = [];
  let score = 0;
  let from = 0;
  for (const ch of needle) {
    const at = haystack.indexOf(ch, from);
    if (at < 0) return null;
    const previous = positions.at(-1);
    if (previous !== undefined && at === previous + 1) score += 8;
    if (at === 0 || BOUNDARY.test(text[at - 1])) score += 10;
    else if (text[at] !== haystack[at] && text[at - 1] === haystack[at - 1]) score += 6;
    score -= previous === undefined ? Math.min(at, 10) * 0.1 : (at - previous - 1) * 0.5;
    positions.push(at);
    from = at + 1;
  }
  return { score: score + 1, positions };
}

export function bestMatch(fields: string[], query: string): { field: number; match: FuzzyMatch } | null {
  let best: { field: number; match: FuzzyMatch } | null = null;
  fields.forEach((text, field) => {
    const match = fuzzyMatch(text, query);
    if (match && (!best || match.score > best.match.score)) best = { field, match };
  });
  return best;
}
