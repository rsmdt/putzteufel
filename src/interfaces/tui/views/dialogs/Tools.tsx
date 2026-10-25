import { human } from '../../../../domain/format.ts';
import { uniqueSize } from '../../../../domain/overlap.ts';
import type { Target, Tool } from '../../../../domain/types.ts';
import { Overlay } from '../../components/Overlay.tsx';
import type { Context } from '../../keys.ts';
import { useLook } from '../../look.ts';
import { fit } from '../../map/layout.ts';
import { type Screen, dialogSize } from './shared.tsx';

export interface ToolsDialogProps {
  screen: Screen;
  context: Extract<Context, 'tools' | 'suggest'>;
  tools: Tool[];
  items: Target[];
  install: Set<string>;
  cursor: number;
  uninstallAfter: boolean;
}

const TEXT = {
  tools: {
    title: 'Native tools',
    intro: 'These items have their own cleanup tool, which is not installed.',
    detail: 'Checked tools are installed first and do the cleanup. Unchecked ones: their folders are deleted directly.',
    uninstall: 'Uninstall the tools installed here after the cleanup (only the formula; dependencies brew pulled in stay)',
  },
  suggest: {
    title: 'Suggested tools',
    intro: 'The scan found items that these tools clean better than deleting their folders.',
    detail: 'Checked tools are installed now with brew; their items are then rescanned and cleaned with the tool. Nothing is removed yet.',
    uninstall: 'Uninstall them again after the next cleanup (only the formula; dependencies brew pulled in stay)',
  },
};

export function ToolsDialog({ screen, context, tools, items, install, cursor, uninstallAfter }: ToolsDialogProps) {
  const { theme } = useLook();
  const size = dialogSize(screen);
  const width = size.width - 4;
  const text = TEXT[context];
  return (
    <Overlay title={text.title} context={context} screen={screen} {...size} color={theme.warn}>
      <text wrapMode="none">{fit(text.intro, width)}</text>
      <text wrapMode="none" fg={theme.muted}>
        {fit(text.detail, width)}
      </text>
      <text> </text>
      {tools.map((t, i) => {
        const using = items.filter((x) => x.tool?.bin === t.bin);
        return (
          <text key={t.bin} wrapMode="none" bg={i === cursor ? theme.activeBg : undefined}>
            {`${install.has(t.bin) ? '[x]' : '[ ]'} `}
            <strong>{t.bin.padEnd(14)}</strong>
            <span fg={theme.warn}>{`$ ${t.install}`.padEnd(36)}</span>
            <span fg={theme.muted}>{fit(`  then $ ${t.clean[0]?.run ?? ''}  ·  ${using.length} item(s), ${human(uniqueSize(using))}: ${[...new Set(using.map((x) => x.plugin))].join(', ')}`, Math.max(10, width - 56))}</span>
          </text>
        );
      })}
      <text> </text>
      <text wrapMode="none" bg={cursor === tools.length ? theme.activeBg : undefined}>
        {`${uninstallAfter ? '[x]' : '[ ]'} `}
        {fit(text.uninstall, width - 4)}
      </text>
    </Overlay>
  );
}
