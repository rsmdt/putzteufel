import { IMPACTS } from '../../../domain/impact.ts';
import { type Target } from '../../../domain/types.ts';
import { type Step } from '../../../domain/run-plan.ts';
import { human } from '../../../domain/format.ts';
import { tildify } from '../../../domain/paths.ts';
import { EmptyState, type EmptyStateProps } from '../components/EmptyState.tsx';
import { Frame, wheelDelta } from '../components/Frame.tsx';
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
  spinner?: string;
  waiting?: boolean;
  run?: Step;
  frame: number;
}

const BAR_CELLS = 10;
const BAR_WIDTH = BAR_CELLS + 12;

function Marker({ color, spinner, waiting }: { color?: string; spinner?: string; waiting?: boolean }) {
  const { theme, icons } = useLook();
  if (spinner) return <span fg={theme.accent}>{`${spinner} `}</span>;
  if (waiting) return <span fg={theme.muted}>{`${icons.waiting} `}</span>;
  return <Swatch color={color} />;
}

function barText(step: Step, frame: number, full: string, empty: string): string {
  if (step.state === 'done') return full.repeat(BAR_CELLS);
  if (step.state !== 'running') return empty.repeat(BAR_CELLS);
  if (step.progress === undefined) return Array.from({ length: BAR_CELLS }, (_, i) => (i === frame % BAR_CELLS ? full : empty)).join('');
  const filled = Math.round(step.progress * BAR_CELLS);
  return full.repeat(filled) + empty.repeat(BAR_CELLS - filled);
}

function RunBar({ step, frame }: { step: Step; frame: number }) {
  const { theme, icons } = useLook();
  const label = {
    pending: 'queued',
    running: step.progress === undefined ? 'running' : `${Math.round(step.progress * 100)}%`,
    done: `${icons.done} ${human(step.bytes)}`,
    failed: `${icons.failed} failed`,
    skipped: `${icons.skipped} skipped`,
  }[step.state];
  const color = { pending: theme.muted, running: theme.accent, done: theme.ok, failed: theme.error, skipped: theme.warn }[step.state];
  return <span fg={color}>{` ${barText(step, frame, icons.barFull, icons.barEmpty)} ${label}`.padEnd(BAR_WIDTH)}</span>;
}

function RowLine({ row, active, young, shared, width, color, highlight, spinner, waiting, run, frame }: RowProps) {
  const { theme, icons } = useLook();
  const bg = active ? theme.activeBg : undefined;
  if (row.kind === 'section') {
    const label = `${spinner ? `${spinner} ` : waiting ? `${icons.waiting} ` : ''}── ${row.name} `;
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
        <Marker color={color} spinner={spinner} waiting={waiting} />
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
        <Marker color={color} spinner={spinner} waiting={waiting} />
        {`${box(row.targets)} `}
        <Highlighted text={name} positions={name === row.name ? highlight : undefined} color={theme.accent} />
        <span fg={theme.muted}>{row.targets.length ? `  ${stats(row.targets)}` : '  looking for items…'}</span>
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
  const bar = run ? BAR_WIDTH : 0;
  const room = Math.max(8, width - 8 - head.length - tags.length - Math.min(detail.length, 24) - 2 - bar);
  const shown = fit(label, room);
  const used = 6 + head.length + shown.length + (detail ? 2 + Math.min(detail.length, 24) : 0) + tags.length;
  return (
    <text bg={bg} fg={t.selected ? theme.text : theme.muted} wrapMode="none">
      {'    '}
      <Marker color={color} spinner={spinner} waiting={waiting} />
      {head}
      <Highlighted text={shown} positions={shown === label ? highlight : undefined} color={theme.accent} />
      <span fg={theme.muted}>{detail ? `  ${fit(detail, 24)}` : ''}</span>
      <ImpactTag target={t} />
      {recent ? <span fg={theme.accent}> recent</span> : null}
      {alsoText ? <span fg={theme.warn}>{alsoText}</span> : null}
      {run ? ' '.repeat(Math.max(1, width - used - BAR_WIDTH)) : null}
      {run ? <RunBar step={run} frame={frame} /> : null}
    </text>
  );
}

export type Busy = 'active' | 'waiting' | undefined;

interface ListPaneProps {
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
  busy: (row: Row) => Busy;
  runStep: (t: Target) => Step | undefined;
  spinner: string;
  frame: number;
  bottomTitle: string;
  empty?: Omit<EmptyStateProps, 'width' | 'height'>;
  onScroll: (delta: number) => void;
}

export function ListPane({ rows, cursor, offset, width, height, focused, focusColor, colors, highlights, young, shared, busy, runStep, spinner, frame, bottomTitle, empty, onScroll }: ListPaneProps) {
  const inner = { w: width - 2, h: height - 2 };
  return (
    <Frame title={rows.length ? `Items ${Math.min(cursor, rows.length - 1) + 1}/${rows.length}` : 'Items'} bottomTitle={bottomTitle} focused={focused} focusColor={focusColor} width={width} height={height} onMouseScroll={(e) => onScroll(wheelDelta(e))}>
      {rows.length === 0 && empty ? <EmptyState {...empty} width={inner.w} height={inner.h} /> : null}
      {rows.slice(offset, offset + inner.h).map((row, i) => (
        <RowLine key={row.key} row={row} active={offset + i === cursor} young={young} shared={shared} spinner={busy(row) === 'active' ? spinner : undefined} waiting={busy(row) === 'waiting'} run={row.kind === 'target' ? runStep(row.target) : undefined} frame={frame} width={inner.w} color={colors.get(row.key)} highlight={highlights.get(row.key)} />
      ))}
    </Frame>
  );
}
