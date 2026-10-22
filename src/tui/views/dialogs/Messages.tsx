import { Overlay } from '../../components/Overlay.tsx';
import { useLook } from '../../look.ts';
import type { Line } from '../../model/explain.ts';
import { type Message, clock } from '../../model/messages.ts';
import { type Screen, Scrolled, scrolledRange, dialogRows, dialogSize } from './shared.tsx';

export function MessagesDialog({ screen, messages, offset }: { screen: Screen; messages: Message[]; offset: number }) {
  const { theme, icons } = useLook();
  const size = dialogSize(screen);
  const rows = dialogRows(screen);
  const lines: Line[] = [...messages].reverse().map((m) => ({ text: `${icons.caps[m.level]} ${clock(m.at)}  ${m.level.padEnd(5)}  ${m.text}`, fg: m.level === 'error' ? theme.error : m.level === 'warn' ? theme.warn : theme.text }));
  return (
    <Overlay title={`Messages (${messages.length})`} context="messages" screen={screen} {...size} color={theme.muted} bottomTitle={scrolledRange(lines.length, offset, rows)}>
      {lines.length ? <Scrolled lines={lines} offset={offset} rows={rows} width={size.width - 4} /> : <text fg={theme.muted}>No messages yet.</text>}
    </Overlay>
  );
}
