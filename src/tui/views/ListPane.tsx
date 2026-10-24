import { IMPACTS, type Target, human, tildify } from '../../core/index.ts';
import { EmptyState, type EmptyStateProps } from '../components/EmptyState.tsx';
import { Frame } from '../components/Frame.tsx';
import { ImpactTag, Swatch } from '../components/Tags.tsx';
import { Highlighted } from '../components/Text.tsx';
import { useLook } from '../look.ts';
import { fit } from '../map/layout.ts';
import { type Row, box, stats, targetDetail } from '../model/rows.ts';

interface RowProps {
  row: Row;
  active: boolean;
  young: (t: Target) => boolean;
  shared: (t: Target) => string[];
  width: number;
  color?: string;
  highlight?: number[];
}

function RowLine({ row, active, young, shared, width, color, highlight }: RowProps) {
  const { theme, icons } = useLook();
  const bg = active ? theme.activeBg : undefined;
  if (row.kind === 'section') {
    const label = `── ${row.name} `;
    const tail = `  ${stats(row.targets)} `;
    return (
      <text bg={bg} wrapMode="none" fg={theme.muted}>
        <strong fg={theme.accent}>{label}</strong>
        {'─'.repeat(Math.max(2, width - label.length - tail.length))}
        {tail}
      </text>
    );
  }
  if (row.kind === 'group') {
    return (
      <text bg={bg} wrapMode="none">
        <Swatch color={color} />
        <strong>{`${icons.category(row.name)}${fit(row.name, width - 30)}`}</strong>
        <span fg={theme.muted}>{`  ${stats(row.targets)}`}</span>
      </text>
    );
  }
  if (row.kind === 'plugin') {
    const name = fit(row.name, width - 48);
    return (
      <text bg={bg} wrapMode="none">
        {'  '}
        <Swatch color={color} />
        {`${box(row.targets)} `}
        <Highlighted text={name} positions={name === row.name ? highlight : undefined} color={theme.accent} />
        <span fg={theme.muted}>{`  ${stats(row.targets)}`}</span>
        {row.targets[0] ? <ImpactTag target={row.targets[0]} /> : null}
      </text>
    );
  }
  const t = row.target;
  const age = t.ageDays === undefined ? '' : `${Math.floor(t.ageDays)}d`;
  const recent = young(t);
  const also = shared(t);
  const alsoText = also.length ? ` also: ${also.join(', ')}` : '';
  const tags = ` ${IMPACTS[t.impact].tag}${recent ? ' recent' : ''}${alsoText}`;
  const size = t.size === undefined ? '…' : `${t.estimated ? '≈' : ''}${human(t.size)}`;
  const head = `${t.selected ? '[x]' : '[ ]'} ${size.padStart(7)} ${age.padStart(5)}  `;
  const detail = targetDetail(t);
  const label = tildify(t.label);
  const room = Math.max(8, width - 8 - head.length - tags.length - Math.min(detail.length, 24) - 2);
  const shown = fit(label, room);
  return (
    <text bg={bg} fg={t.selected ? theme.text : theme.muted} wrapMode="none">
      {'    '}
      <Swatch color={color} />
      {head}
      <Highlighted text={shown} positions={shown === label ? highlight : undefined} color={theme.accent} />
      <span fg={theme.muted}>{detail ? `  ${fit(detail, 24)}` : ''}</span>
      <ImpactTag target={t} />
      {recent ? <span fg={theme.accent}> recent</span> : null}
      {alsoText ? <span fg={theme.warn}>{alsoText}</span> : null}
    </text>
  );
}

export interface ListPaneProps {
  rows: Row[];
  cursor: number;
  offset: number;
  width: number;
  height: number;
  focused: boolean;
  focusColor: string;
  colors: Map<string, string>;
  highlights: Map<string, number[]>;
  young: (t: Target) => boolean;
  shared: (t: Target) => string[];
  bottomTitle: string;
  empty?: Omit<EmptyStateProps, 'width' | 'height'>;
}

export function ListPane({ rows, cursor, offset, width, height, focused, focusColor, colors, highlights, young, shared, bottomTitle, empty }: ListPaneProps) {
  const inner = { w: width - 2, h: height - 2 };
  return (
    <Frame title={rows.length ? `Items ${Math.min(cursor, rows.length - 1) + 1}/${rows.length}` : 'Items'} bottomTitle={bottomTitle} focused={focused} focusColor={focusColor} width={width} height={height}>
      {rows.length === 0 && empty ? <EmptyState {...empty} width={inner.w} height={inner.h} /> : null}
      {rows.slice(offset, offset + inner.h).map((row, i) => (
        <RowLine key={row.key} row={row} active={offset + i === cursor} young={young} shared={shared} width={inner.w} color={colors.get(row.key)} highlight={highlights.get(row.key)} />
      ))}
    </Frame>
  );
}
