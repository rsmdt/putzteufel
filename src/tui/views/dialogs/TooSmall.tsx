import { useLook } from '../../look.ts';
import { type Screen } from './shared.tsx';

export const MIN_SIZE = { width: 60, height: 16 };

export function TooSmall({ screen }: { screen: Screen }) {
  const { theme } = useLook();
  const color = (have: number, need: number) => (have < need ? theme.error : theme.ok);
  return (
    <box flexDirection="column" width={screen.width} height={screen.height} justifyContent="center" alignItems="center">
      <text fg={theme.text}>Terminal too small for putzteufel</text>
      <text>
        {'width '}
        <span fg={color(screen.width, MIN_SIZE.width)}>{String(screen.width)}</span>
        {` of ${MIN_SIZE.width} · height `}
        <span fg={color(screen.height, MIN_SIZE.height)}>{String(screen.height)}</span>
        {` of ${MIN_SIZE.height}`}
      </text>
      <text fg={theme.muted}>Enlarge the window, or use putzteufel --list</text>
    </box>
  );
}
