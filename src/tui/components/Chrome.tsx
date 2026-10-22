import { fit } from '../map/layout.ts';
import { fitHints, HINT_SEPARATOR } from '../hints.ts';
import { type Context, footerHints } from '../keys.ts';
import { useLook } from '../look.ts';
import { type Message, clock } from '../model/messages.ts';
import type { Theme } from '../theme.ts';

export const MODE_LABELS: Record<Context, string> = {
  list: 'LIST',
  filter: 'FILTER',
  files: 'FILES',
  map: 'MAP',
  preview: 'PREVIEW',
  tools: 'TOOLS',
  review: 'REVIEW',
  progress: 'CLEANING',
  failure: 'FAILED',
  done: 'DONE',
  help: 'HELP',
  helpSearch: 'HELP',
  messages: 'MESSAGES',
  sort: 'SORT',
  theme: 'THEME',
  welcome: 'WELCOME',
};

export function modeColor(context: Context, theme: Theme): string {
  if (context === 'filter' || context === 'tools') return theme.warn;
  if (context === 'review' || context === 'failure') return theme.error;
  if (context === 'done') return theme.ok;
  if (['help', 'helpSearch', 'messages', 'sort', 'theme', 'welcome'].includes(context)) return theme.muted;
  return theme.accent;
}

export const PILL_WIDTH = 10;

export function ModePill({ context }: { context: Context }) {
  const { theme } = useLook();
  const label = MODE_LABELS[context];
  const pad = PILL_WIDTH - label.length;
  return (
    <strong fg={theme.panel} bg={modeColor(context, theme)}>
      {`${' '.repeat(Math.floor(pad / 2))}${label}${' '.repeat(Math.ceil(pad / 2))}`}
    </strong>
  );
}

export function MessageBar({ messages, width }: { messages: Message[]; width: number }) {
  const { theme, icons } = useLook();
  const last = messages.at(-1);
  if (!last) return <text> </text>;
  const color = last.level === 'error' ? theme.error : last.level === 'warn' ? theme.warn : theme.muted;
  const more = messages.length > 1 ? `  (${messages.length} messages, w shows all)` : '';
  return (
    <text wrapMode="none">
      <span fg={color}>{`${icons.caps[last.level]} `}</span>
      <span fg={theme.border}>{`${clock(last.at)} `}</span>
      <span fg={last.level === 'info' ? theme.text : color}>{fit(last.text, Math.max(10, width - 12 - more.length))}</span>
      <span fg={theme.border}>{more}</span>
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
