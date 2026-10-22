import { Overlay } from '../../components/Overlay.tsx';
import { useLook } from '../../look.ts';
import { THEMES, type Theme } from '../../theme.ts';
import { type Screen } from './shared.tsx';

export function ThemeDialog({ screen, cursor }: { screen: Screen; cursor: number }) {
  const { theme } = useLook();
  return (
    <Overlay title="Theme" context="theme" screen={screen} width={44} height={THEMES.length + 6} color={theme.muted} bottomTitle={`${cursor + 1}/${THEMES.length}`}>
      {THEMES.map((t, i) => (
        <text key={t.name} wrapMode="none" bg={i === cursor ? theme.activeBg : undefined}>
          {`${t.name.padEnd(16)}`}
          {Object.values(t.impact).map((c, j) => (
            <span key={j} fg={c}>
              ●
            </span>
          ))}
        </text>
      ))}
      <text fg={theme.muted}>Moving previews the theme; esc restores.</text>
    </Overlay>
  );
}
