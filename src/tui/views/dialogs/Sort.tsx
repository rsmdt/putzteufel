import { Overlay } from '../../components/Overlay.tsx';
import { useLook } from '../../look.ts';
import { SORT_KEYS, type Sort } from '../../sort.ts';
import { type Screen } from './shared.tsx';

export function SortDialog({ screen, sort, cursor }: { screen: Screen; sort: Sort; cursor: number }) {
  const { theme } = useLook();
  return (
    <Overlay title="Sort" context="sort" screen={screen} width={40} height={9} color={theme.muted} bottomTitle={`${cursor + 1}/${SORT_KEYS.length}`}>
      {SORT_KEYS.map((k, i) => (
        <text key={k.key} wrapMode="none" bg={i === cursor ? theme.activeBg : undefined}>
          {`${sort.key === k.key ? '●' : ' '} ${k.label.padEnd(6)}`}
          <span fg={theme.muted}>{sort.reverse ? ` reversed` : ` ${k.detail}`}</span>
        </text>
      ))}
      <text fg={theme.muted}>{`R reverses: now ${sort.reverse ? 'reversed' : 'normal'}`}</text>
    </Overlay>
  );
}
