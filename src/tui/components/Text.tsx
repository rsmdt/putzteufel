import { fit } from '../map/layout.ts';
import { useLook } from '../look.ts';
import type { Line } from '../model/explain.ts';

export function LineText({ line, width, fg }: { line: Line; width: number; fg?: string }) {
  const { text, fg: own, bold } = typeof line === 'string' ? { text: line, fg: undefined, bold: false } : line;
  return (
    <text wrapMode="none" fg={own ?? fg}>
      {bold ? <strong>{fit(text, width)}</strong> : fit(text, width)}
    </text>
  );
}

export function Highlighted({ text, positions, color }: { text: string; positions?: number[]; color: string }) {
  if (!positions?.length) return <>{text}</>;
  const marks = new Set(positions);
  const parts: { text: string; hit: boolean }[] = [];
  [...text].forEach((ch, i) => {
    const hit = marks.has(i);
    const last = parts.at(-1);
    if (last && last.hit === hit) last.text += ch;
    else parts.push({ text: ch, hit });
  });
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <u key={i} fg={color}>
            {p.text}
          </u>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function KeyChip({ keys, label }: { keys: string; label?: string }) {
  const { theme } = useLook();
  return (
    <>
      <strong fg={theme.accent}>{keys}</strong>
      {label ? <span fg={theme.muted}>{` ${label}`}</span> : null}
    </>
  );
}
