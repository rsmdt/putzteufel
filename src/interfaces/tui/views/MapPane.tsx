import type { BoxRenderable, MouseEvent } from '@opentui/core';
import { useMemo, useRef } from 'react';
import { human } from '../../../domain/format.ts';
import { Frame } from '../components/Frame.tsx';
import { useLook } from '../look.ts';
import { type Cell, type MapNode, ancestry, arcAtPixel, rectAt, renderSunburst, renderTreemap, sunburstArcs, sunburstGeometry, toRuns, treemapRects } from '../map/layout.ts';

export type MapMode = 'sunburst' | 'treemap' | 'off';

export const MAP_MIN_WIDTH = 90;

interface MapPaneProps {
  mode: Exclude<MapMode, 'off'>;
  root: MapNode;
  treemapFocus: MapNode;
  activeKey?: string;
  depth: number;
  width: number;
  height: number;
  focused: boolean;
  focusColor: string;
  onPick: (key: string | 'center') => void;
}

function CellRows({ grid }: { grid: Cell[][] }) {
  return (
    <>
      {grid.map((row, y) => (
        <text key={y} wrapMode="none">
          {toRuns(row).map((run, i) => (
            <span key={i} fg={run.fg} bg={run.bg}>
              {run.text}
            </span>
          ))}
        </text>
      ))}
    </>
  );
}

export function MapPane({ mode, root, treemapFocus, activeKey, depth, width, height, focused, focusColor, onPick }: MapPaneProps) {
  const { icons } = useLook();
  const ref = useRef<BoxRenderable>(null);
  const inner = { w: Math.max(4, width - 2), h: Math.max(2, height - 2) };
  const grid = useMemo(() => {
    if (mode === 'treemap') return renderTreemap(treemapRects(treemapFocus, inner.w, inner.h), inner.w, inner.h, activeKey, (n) => human(n.size), icons.map);
    const focus = ancestry(root, activeKey ?? '').at(-1) ?? root;
    const share = root.size ? `${Math.round((focus.size / root.size) * 100)}%` : '';
    return renderSunburst(root, inner.w, inner.h, activeKey, [focus.label, human(focus.size), share], depth, icons.map);
  }, [mode, root, treemapFocus, activeKey, inner.w, inner.h, depth, icons]);

  const onMouseDown = (event: MouseEvent) => {
    const box = ref.current;
    if (!box) return;
    const x = event.x - box.screenX - 1;
    const y = event.y - box.screenY - 1;
    if (mode === 'treemap') {
      const key = rectAt(treemapRects(treemapFocus, inner.w, inner.h), x, y)?.node.key;
      if (key) onPick(key);
      return;
    }
    const hit = arcAtPixel(sunburstArcs(root, depth), sunburstGeometry(inner.w, inner.h, depth), x, y * 2);
    if (hit) onPick(hit === 'center' ? 'center' : hit.node.key);
  };

  const title = mode === 'sunburst' ? 'sunburst · m treemap' : 'treemap · m hide';
  return (
    <Frame boxRef={ref} title={title} bottomTitle={focused ? '←→ slices · ↑ out · ↓ in' : undefined} focused={focused} focusColor={focusColor} width={width} height={height} onMouseDown={onMouseDown}>
      <CellRows grid={grid} />
    </Frame>
  );
}
