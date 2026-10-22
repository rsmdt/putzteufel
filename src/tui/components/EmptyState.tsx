import { fit } from '../map/layout.ts';
import { useLook } from '../look.ts';
import { KeyChip } from './Text.tsx';

export interface EmptyStateProps {
  message: string;
  detail?: string[];
  hint?: { keys: string; label: string };
  width: number;
  height: number;
}

export function EmptyState({ message, detail = [], hint, width, height }: EmptyStateProps) {
  const { theme } = useLook();
  const lines = 1 + detail.length + (hint ? 2 : 0);
  return (
    <box flexDirection="column" height={height} width={width} justifyContent="center" alignItems="center" paddingTop={Math.max(0, Math.floor((height - lines) / 2) - 1)}>
      <text fg={theme.muted}>{fit(message, width - 2)}</text>
      {detail.map((d, i) => (
        <text key={i} fg={theme.border}>
          {fit(d, width - 2)}
        </text>
      ))}
      {hint ? (
        <text>
          {' '}
        </text>
      ) : null}
      {hint ? (
        <text>
          <KeyChip keys={hint.keys} label={hint.label} />
        </text>
      ) : null}
    </box>
  );
}
