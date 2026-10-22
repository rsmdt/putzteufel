import { Overlay } from '../../components/Overlay.tsx';
import { fuzzyMatch } from '../../fuzzy.ts';
import { helpSections } from '../../keys.ts';
import { useLook } from '../../look.ts';
import type { Line } from '../../model/explain.ts';
import { type Theme } from '../../theme.ts';
import { type Screen, Scrolled, scrolledRange, dialogRows, dialogSize } from './shared.tsx';

export function helpLines(query: string, legend: Line[], theme: Theme): Line[] {
  const lines: Line[] = [];
  for (const section of helpSections()) {
    const rows = section.rows.filter((r) => !query || fuzzyMatch(`${r.keys} ${r.label} ${section.title}`, query));
    if (!rows.length) continue;
    lines.push({ text: section.title, bold: true, fg: theme.accent });
    for (const r of rows) lines.push(`  ${r.keys.padEnd(22)} ${r.label}`);
    lines.push('');
  }
  if (!query || 'tags impact legend'.includes(query.toLowerCase())) lines.push(...legend);
  return lines;
}

export function HelpDialog({ screen, lines, offset, query, searching }: { screen: Screen; lines: Line[]; offset: number; query: string; searching: boolean }) {
  const { theme } = useLook();
  const size = dialogSize(screen);
  const rows = dialogRows(screen) - 1;
  return (
    <Overlay title="Help" context={searching ? 'helpSearch' : 'help'} screen={screen} {...size} color={theme.muted} bottomTitle={scrolledRange(lines.length, offset, rows)}>
      <text wrapMode="none" fg={searching ? theme.warn : theme.muted}>
        {searching || query ? `search: ${query}${searching ? '▌' : ''}` : 'Every key, from the same list the footer uses. / searches.'}
      </text>
      {lines.length ? <Scrolled lines={lines} offset={offset} rows={rows} width={size.width - 4} /> : <text fg={theme.muted}>{`No key matches “${query}”.`}</text>}
    </Overlay>
  );
}
