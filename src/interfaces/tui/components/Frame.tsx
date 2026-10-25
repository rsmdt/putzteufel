import type { BoxRenderable, MouseEvent } from '@opentui/core';
import type { ReactNode, Ref } from 'react';
import { useLook } from '../look.ts';

interface FrameProps {
  title?: string;
  bottomTitle?: string;
  focused?: boolean;
  focusColor?: string;
  width?: number;
  height?: number;
  boxRef?: Ref<BoxRenderable>;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseScroll?: (event: MouseEvent) => void;
  children?: ReactNode;
}

export function Frame({ title, bottomTitle, focused, focusColor, width, height, boxRef, onMouseDown, onMouseScroll, children }: FrameProps) {
  const { theme } = useLook();
  const color = focused ? (focusColor ?? theme.accent) : theme.border;
  return (
    <box
      ref={boxRef}
      width={width}
      height={height}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={color}
      title={title ? ` ${title} ` : undefined}
      titleColor={focused ? color : theme.muted}
      bottomTitle={bottomTitle ? ` ${bottomTitle} ` : undefined}
      bottomTitleAlignment="right"
      onMouseDown={onMouseDown}
      onMouseScroll={onMouseScroll}
    >
      {children}
    </box>
  );
}
