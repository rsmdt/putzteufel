import { useEffect, useState } from 'react';
import { fit } from '../map/layout.ts';
import { fitHints, HINT_SEPARATOR, type HintPriority } from '../hints.ts';
import { type Context, footerHints } from '../keys.ts';
import { useLook } from '../look.ts';
import { type Message, clock } from '../model/messages.ts';
import { type Theme } from '../theme.ts';

const MODE_LABELS: Record<Context, string> = {
  list: 'LIST',
  filter: 'FILTER',
  files: 'FILES',
  map: 'MAP',
  preview: 'PREVIEW',
  tools: 'TOOLS',
  suggest: 'TOOLS',
  review: 'REVIEW',
  help: 'HELP',
  helpSearch: 'HELP',
  sort: 'SORT',
  theme: 'THEME',
  welcome: 'WELCOME',
};

export function modeColor(context: Context, theme: Theme): string {
  if (context === 'filter' || context === 'tools' || context === 'suggest') return theme.warn;
  if (context === 'review') return theme.error;
  if (['help', 'helpSearch', 'sort', 'theme', 'welcome'].includes(context)) return theme.muted;
  return theme.accent;
}

const PILL_WIDTH = 10;

function ModePill({ context, label = MODE_LABELS[context] }: { context: Context; label?: string }) {
  const { theme } = useLook();
  const pad = PILL_WIDTH - label.length;
  return (
    <strong fg={theme.panel} bg={modeColor(context, theme)}>
      {`${' '.repeat(Math.floor(pad / 2))}${label}${' '.repeat(Math.ceil(pad / 2))}`}
    </strong>
  );
}

interface Segment {
  text: string;
  priority: HintPriority;
  color?: string;
  bold?: boolean;
}

function fitSegments(segments: Segment[], width: number): Segment[] {
  const total = (list: Segment[]) => list.reduce((n, s) => n + s.text.length, 0) + Math.max(0, list.length - 1) * HINT_SEPARATOR.length;
  const kept = [...segments];
  for (const priority of ['optional', 'normal'] as HintPriority[]) {
    for (let i = kept.length - 1; i >= 0 && total(kept) > width; i--) if (kept[i].priority === priority) kept.splice(i, 1);
  }
  return kept;
}

const SPINNER_INTERVAL = 80;

function Spinner({ active }: { active: boolean }) {
  const { theme, icons } = useLook();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setFrame((f) => f + 1), SPINNER_INTERVAL);
    return () => clearInterval(timer);
  }, [active]);
  return <strong fg={active ? theme.accent : theme.ok}>{active ? `${icons.spinner[frame % icons.spinner.length]} ` : `${icons.done} `}</strong>;
}

export function HeaderBar({ context, width, segments, busy, mode }: { context: Context; width: number; segments: Segment[]; busy: boolean; mode?: string }) {
  const { theme } = useLook();
  const shown = fitSegments(segments, width - PILL_WIDTH - 4);
  return (
    <text wrapMode="none" fg={theme.text}>
      <Spinner active={busy} />
      <ModePill context={context} label={mode} />
      {' '}
      {shown.map((s, i) => (
        <span key={i}>
          {i ? <span fg={theme.border}>{HINT_SEPARATOR}</span> : null}
          {s.bold ? <strong fg={s.color}>{s.text}</strong> : <span fg={s.color}>{s.text}</span>}
        </span>
      ))}
    </text>
  );
}

export function MessageBar({ message, width }: { message?: Message; width: number }) {
  const { theme, icons } = useLook();
  if (!message) return <text> </text>;
  const color = message.level === 'error' ? theme.error : message.level === 'warn' ? theme.warn : theme.muted;
  return (
    <text wrapMode="none">
      <span fg={color}>{`${icons.caps[message.level]} `}</span>
      <span fg={theme.border}>{`${clock(message.at)} `}</span>
      <span fg={message.level === 'info' ? theme.text : color}>{fit(message.text, Math.max(10, width - 12))}</span>
    </text>
  );
}

export function Footer({ context, width, prefix = '' }: { context: Context; width: number; prefix?: string }) {
  const { theme } = useLook();
  const { hints, truncated } = fitHints(footerHints(context), Math.max(10, width - prefix.length - 1));
  return (
    <text wrapMode="none">
      {prefix ? <span fg={theme.warn}>{prefix}</span> : null}
      {hints.map((h, i) => (
        <span key={i}>
          {i ? <span fg={theme.border}>{HINT_SEPARATOR}</span> : null}
          <strong fg={theme.accent}>{h.key}</strong>
          {h.label ? <span fg={theme.muted}>{` ${h.label}`}</span> : null}
        </span>
      ))}
      {truncated ? <span fg={theme.muted}>{' …'}</span> : null}
    </text>
  );
}
