import { IMPACTS } from '../../../domain/impact.ts';
import { type Target } from '../../../domain/types.ts';
import { useLook } from '../look.ts';

export function Swatch({ color }: { color?: string }) {
  const { theme, icons } = useLook();
  return <span fg={color ?? theme.muted}>{`${icons.swatch} `}</span>;
}

export function ImpactTag({ target }: { target: Target }) {
  const { theme } = useLook();
  return <span fg={theme.impact[target.impact]}>{` ${IMPACTS[target.impact].tag}`}</span>;
}
