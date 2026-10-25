import { human } from '../../../domain/format.ts';
import { tildify } from '../../../domain/paths.ts';
import { EmptyState } from '../components/EmptyState.tsx';
import { Frame, wheelDelta } from '../components/Frame.tsx';
import { useDelayed } from '../hooks.ts';
import { useLook } from '../look.ts';
import { fit } from '../map/layout.ts';
import { type Browse, currentLevel, entryColor } from '../model/browse.ts';

interface FilesPaneProps {
  browse: Browse;
  width: number;
  height: number;
  focused: boolean;
  focusColor: string;
  sortLabel: string;
  owners: (path: string) => string[];
  onScroll: (delta: number) => void;
}

export function FilesPane({ browse, width, height, focused, focusColor, sortLabel, owners, onScroll }: FilesPaneProps) {
  const { theme, icons } = useLook();
  const level = currentLevel(browse);
  const inner = { w: width - 2, h: height - 2 };
  const loading = useDelayed(!level.entries);
  const entries = level.entries ?? [];
  const total = entries.reduce((n, e) => n + e.size, 0);
  const where = tildify(level.dir ?? browse.target.label);
  const title = `${browse.target.selected ? '[x]' : '[ ]'} ${fit(where, Math.max(10, inner.w - 20))}`;
  const bottom = level.entries ? `${entries.length ? level.cursor + 1 : 0}/${entries.length} · ${sortLabel} · ${human(total)}` : sortLabel;
  return (
    <Frame title={title} bottomTitle={bottom} focused={focused} focusColor={focusColor} width={width} height={height} onMouseScroll={(e) => onScroll(wheelDelta(e))}>
      {loading ? <EmptyState message="Measuring folder sizes…" width={inner.w} height={inner.h} /> : null}
      {level.entries && !entries.length ? (
        browse.target.paths.length ? (
          <EmptyState message="This folder is empty." hint={{ keys: '←', label: 'up a level' }} width={inner.w} height={inner.h} />
        ) : (
          <EmptyState message="Nothing to browse: this item runs a tool command." detail={['The preview shows the command and what it lists.']} hint={{ keys: 'esc', label: 'back to the list' }} width={inner.w} height={inner.h} />
        )
      ) : null}
      {entries.slice(level.offset, level.offset + inner.h).map((e, i) => {
        const also = owners(e.path);
        const tag = also.length ? `  ${also.join(', ')}` : '';
        return (
          <text key={e.path} wrapMode="none" bg={level.offset + i === level.cursor ? theme.activeBg : undefined}>
            <span fg={entryColor(level.offset + i, theme.hues)}>{`${icons.swatch} `}</span>
            {`${human(e.size).padStart(7)}  `}
            {fit(e.name + (e.isDir ? '/' : ''), Math.max(8, inner.w - 14 - tag.length))}
            <span fg={theme.warn}>{tag}</span>
          </text>
        );
      })}
    </Frame>
  );
}
