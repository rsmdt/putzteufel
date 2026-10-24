import { LineText } from '../../components/Text.tsx';
import { type Line } from '../../model/explain.ts';

export type Screen = { width: number; height: number };

export function Scrolled({ lines, offset, rows, width }: { lines: Line[]; offset: number; rows: number; width: number }) {
  const start = Math.min(offset, Math.max(0, lines.length - rows));
  return (
    <>
      {lines.slice(start, start + rows).map((line, i) => (
        <LineText key={i} line={line} width={width} />
      ))}
    </>
  );
}

export function scrolledRange(total: number, offset: number, rows: number): string | undefined {
  if (total <= rows) return undefined;
  const start = Math.min(offset, Math.max(0, total - rows));
  return `${start + 1}-${Math.min(total, start + rows)}/${total}`;
}

export function dialogRows(screen: Screen): number {
  return Math.max(3, Math.min(screen.height - 2, Math.floor(screen.height * 0.9)) - 4);
}

export function dialogSize(screen: Screen) {
  return { width: Math.max(40, Math.floor(screen.width * 0.9)), height: Math.max(10, Math.floor(screen.height * 0.9)) };
}
