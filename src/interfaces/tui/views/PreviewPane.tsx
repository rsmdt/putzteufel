import { Frame } from '../components/Frame.tsx';
import { LineText } from '../components/Text.tsx';
import { useLook } from '../look.ts';
import { type Line } from '../model/explain.ts';

export interface PreviewPaneProps {
  lines: Line[];
  offset: number;
  width: number;
  height: number;
  focused: boolean;
  focusColor: string;
}

export function previewRows(height: number): number {
  return Math.max(1, height - 2);
}

export function PreviewPane({ lines, offset, width, height, focused, focusColor }: PreviewPaneProps) {
  const { theme } = useLook();
  const rows = previewRows(height);
  const start = Math.min(offset, Math.max(0, lines.length - rows));
  const more = lines.length > rows ? `${start + 1}-${Math.min(lines.length, start + rows)}/${lines.length}${focused ? '' : ' · tab to scroll'}` : undefined;
  return (
    <Frame title="Preview" bottomTitle={more} focused={focused} focusColor={focusColor} width={width} height={height}>
      {lines.slice(start, start + rows).map((line, i) => (
        <LineText key={i} line={line} width={width - 2} fg={start + i > 0 ? theme.muted : theme.text} />
      ))}
    </Frame>
  );
}
