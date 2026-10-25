import type { ReactNode } from 'react';
import { type Context, footerHints } from '../keys.ts';
import { fitHints, HINT_SEPARATOR } from '../hints.ts';
import { useLook } from '../look.ts';

interface OverlayProps {
  title: string;
  context: Context;
  screen: { width: number; height: number };
  width: number;
  height: number;
  color?: string;
  bottomTitle?: string;
  children?: ReactNode;
}

function overlaySize(screen: { width: number; height: number }, width: number, height: number) {
  return { width: Math.min(width, screen.width - 2), height: Math.min(height, screen.height - 2) };
}

export function Overlay({ title, context, screen, width, height, color, bottomTitle, children }: OverlayProps) {
  const { theme } = useLook();
  const size = overlaySize(screen, width, height);
  const { hints } = fitHints(footerHints(context), size.width - 4);
  return (
    <>
      <box position="absolute" top={0} left={0} width={screen.width} height={screen.height} zIndex={10} backgroundColor={theme.scrim} />
      <box
        position="absolute"
        zIndex={20}
        top={Math.floor((screen.height - size.height) / 2)}
        left={Math.floor((screen.width - size.width) / 2)}
        width={size.width}
        height={size.height}
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor={color ?? theme.accent}
        backgroundColor={theme.panel}
        title={` ${title} `}
        titleColor={color ?? theme.accent}
        bottomTitle={bottomTitle ? ` ${bottomTitle} ` : undefined}
        bottomTitleAlignment="right"
        paddingLeft={1}
        paddingRight={1}
      >
        <box flexDirection="column" flexGrow={1}>
          {children}
        </box>
        <text wrapMode="none">
          {hints.map((h, i) => (
            <span key={i}>
              {i ? <span fg={theme.border}>{HINT_SEPARATOR}</span> : null}
              <strong fg={theme.accent}>{h.key}</strong>
              {h.label ? <span fg={theme.muted}>{` ${h.label}`}</span> : null}
            </span>
          ))}
        </text>
      </box>
    </>
  );
}
