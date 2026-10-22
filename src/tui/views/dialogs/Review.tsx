import { Overlay } from '../../components/Overlay.tsx';
import { useLook } from '../../look.ts';
import type { Line } from '../../model/explain.ts';
import { type Screen, Scrolled, scrolledRange, dialogRows, dialogSize } from './shared.tsx';

export function ReviewDialog({ screen, lines, offset }: { screen: Screen; lines: Line[]; offset: number }) {
  const { theme } = useLook();
  const size = dialogSize(screen);
  const rows = dialogRows(screen) - 1;
  return (
    <Overlay title="Review the cleanup" context="review" screen={screen} {...size} color={theme.error} bottomTitle={scrolledRange(lines.length, offset, rows)}>
      <Scrolled lines={lines} offset={offset} rows={rows} width={size.width - 4} />
      <box flexGrow={1} />
      <text>
        <span fg={theme.panel} bg={theme.error}>
          {' (y) Clean now '}
        </span>
        {'  '}
        <span fg={theme.text} bg={theme.border}>
          {' (n) Cancel '}
        </span>
      </text>
    </Overlay>
  );
}
