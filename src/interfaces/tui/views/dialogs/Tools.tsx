import { type Target, type Tool } from '../../../../domain/types.ts';
import { human } from '../../../../domain/format.ts';
import { Overlay } from '../../components/Overlay.tsx';
import { useLook } from '../../look.ts';
import { fit } from '../../map/layout.ts';
import { sum } from '../../model/rows.ts';
import { type Screen, dialogSize } from './shared.tsx';

export function ToolsDialog({ screen, tools, selected, install, cursor, uninstallAfter }: { screen: Screen; tools: Tool[]; selected: Target[]; install: Set<string>; cursor: number; uninstallAfter: boolean }) {
  const { theme } = useLook();
  const size = dialogSize(screen);
  const width = size.width - 4;
  return (
    <Overlay title="Native tools" context="tools" screen={screen} {...size} color={theme.warn}>
      <text wrapMode="none">{fit('These items have their own cleanup tool, which is not installed.', width)}</text>
      <text wrapMode="none" fg={theme.muted}>
        {fit('Checked tools are installed first and do the cleanup. Unchecked ones: their folders are deleted directly.', width)}
      </text>
      <text> </text>
      {tools.map((t, i) => {
        const items = selected.filter((x) => x.tool?.bin === t.bin);
        return (
          <text key={t.bin} wrapMode="none" bg={i === cursor ? theme.activeBg : undefined}>
            {`${install.has(t.bin) ? '[x]' : '[ ]'} `}
            <strong>{t.bin.padEnd(14)}</strong>
            <span fg={theme.warn}>{`$ ${t.install}`.padEnd(36)}</span>
            <span fg={theme.muted}>{fit(`  then $ ${t.clean[0]?.run ?? ''}  ·  ${items.length} item(s), ${human(sum(items))}: ${[...new Set(items.map((x) => x.plugin))].join(', ')}`, Math.max(10, width - 56))}</span>
          </text>
        );
      })}
      <text> </text>
      <text wrapMode="none" bg={cursor === tools.length ? theme.activeBg : undefined}>
        {`${uninstallAfter ? '[x]' : '[ ]'} `}
        {fit('Uninstall the tools installed here after the cleanup (only the formula; dependencies brew pulled in stay)', width - 4)}
      </text>
    </Overlay>
  );
}
