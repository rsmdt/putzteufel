import { Overlay } from '../../components/Overlay.tsx';
import { useLook } from '../../look.ts';
import { fit } from '../../map/layout.ts';
import { type Screen } from './shared.tsx';

export function WelcomeDialog({ screen }: { screen: Screen }) {
  const { theme } = useLook();
  const lines = [
    'putzteufel finds folders that developer tools can recreate and frees the space they take.',
    '',
    'Nothing is removed until you press d, read the review screen and press y.',
    'Every item has a tag saying what happens after removal; ? explains them.',
    'enter or f on an item lists its files. The map on the right shows sizes.',
    '',
    'Start: ↑↓ to move, space to (de)select, d to review.',
    '',
    'putzteufel comes with no warranty (GPL-3.0, sections 15 and 16). You decide what is removed; review it first.',
  ];
  return (
    <Overlay title="Welcome to putzteufel" context="welcome" screen={screen} width={84} height={lines.length + 5} color={theme.accent}>
      {lines.map((l, i) => (
        <text key={i} wrapMode="none" fg={i === 0 ? theme.text : theme.muted}>
          {fit(l, 80)}
        </text>
      ))}
    </Overlay>
  );
}
