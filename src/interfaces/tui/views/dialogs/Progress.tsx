import { human } from '../../../../domain/format.ts';
import { type Step } from '../../../../domain/run-plan.ts';
import { Overlay } from '../../components/Overlay.tsx';
import { KeyChip } from '../../components/Text.tsx';
import { useLook } from '../../look.ts';
import { fit } from '../../map/layout.ts';
import { type Screen, dialogRows, dialogSize } from './shared.tsx';

const STATE_ORDER: Record<Step['state'], number> = { running: 0, failed: 1, pending: 2, done: 3, skipped: 3 };

export function ProgressDialog({ screen, steps, finishedOrder, failure, done, freed }: { screen: Screen; steps: Step[]; finishedOrder: string[]; failure?: { step: Step; error: string }; done: boolean; freed: number }) {
  const { theme, icons } = useLook();
  const size = dialogSize(screen);
  const width = size.width - 4;
  const items = steps.filter((s) => s.kind === 'item');
  const finished = items.filter((s) => s.state === 'done' || s.state === 'failed' || s.state === 'skipped');
  const totalBytes = items.reduce((n, s) => n + (s.bytes ?? 0), 0);
  const barWidth = Math.max(10, Math.min(60, width - 40));
  const filled = items.length ? Math.round((finished.length / items.length) * barWidth) : barWidth;
  const ordered = [...steps].sort((a, b) => {
    const rank = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (rank) return rank;
    if (STATE_ORDER[a.state] === 3) return finishedOrder.indexOf(b.id) - finishedOrder.indexOf(a.id);
    return steps.indexOf(a) - steps.indexOf(b);
  });
  const icon = (s: Step) => ({ running: icons.running, pending: icons.pending, done: icons.done, failed: icons.failed, skipped: icons.skipped })[s.state];
  const color = (s: Step) => ({ running: theme.accent, pending: theme.muted, done: theme.ok, failed: theme.error, skipped: theme.warn })[s.state];
  const rows = dialogRows(screen) - 3 - (failure ? 4 : 0) - (done ? 2 : 0);
  return (
    <Overlay title={done ? 'Cleanup finished' : 'Cleaning'} context={failure ? 'failure' : done ? 'done' : 'progress'} screen={screen} {...size} color={failure ? theme.error : done ? theme.ok : theme.accent}>
      <text wrapMode="none">
        {Array.from({ length: barWidth }, (_, i) => (
          <span key={i} fg={i < filled ? (i < barWidth / 2 ? theme.accent : theme.ok) : theme.border}>
            {i < filled ? icons.barFull : icons.barEmpty}
          </span>
        ))}
        <span fg={theme.muted}>{`  ${finished.length}/${items.length} items · ${human(freed)} of ${human(totalBytes)} freed`}</span>
      </text>
      <text> </text>
      {ordered.slice(0, Math.max(1, rows)).map((s) => (
        <text key={s.id} wrapMode="none">
          <span fg={color(s)}>{`${icon(s)} `}</span>
          <span fg={s.state === 'pending' ? theme.muted : theme.text}>{fit(s.label, Math.floor(width * 0.5))}</span>
          {s.detail ? <span fg={s.state === 'failed' ? theme.error : theme.muted}>{`  ${fit(s.detail, Math.floor(width * 0.45))}`}</span> : null}
        </text>
      ))}
      <box flexGrow={1} />
      {failure ? (
        <box flexDirection="column" border borderStyle="rounded" borderColor={theme.error} paddingLeft={1}>
          <text wrapMode="none" fg={theme.error}>
            {fit(`Could not clean ${failure.step.label}: ${failure.error}`, width - 4)}
          </text>
          <text>
            <KeyChip keys="(r)" label="Retry   " />
            <KeyChip keys="(s)" label="Skip   " />
            <KeyChip keys="(S)" label="Skip all failures   " />
            <KeyChip keys="(a)" label="Abort the rest" />
          </text>
        </box>
      ) : null}
      {done ? <text fg={theme.ok}>{`Done. Freed about ${human(freed)}. Press enter to go back.`}</text> : null}
    </Overlay>
  );
}
