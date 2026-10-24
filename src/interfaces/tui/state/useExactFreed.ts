import { useEffect, useState } from 'react';
import { coveredIn } from '../../../domain/overlap.ts';
import type { Target } from '../../../domain/types.ts';
import { type Freed, exactFreed } from '../../../infrastructure/measure.ts';

export function useExactFreed(active: boolean, selected: Target[]): Freed | 'pending' | undefined {
  const [exact, setExact] = useState<Freed | 'pending' | undefined>();
  useEffect(() => {
    if (!active) return setExact(undefined);
    let cancelled = false;
    setExact('pending');
    const covered = coveredIn(selected);
    exactFreed(selected.filter((t) => !covered.has(t.id)).flatMap((t) => t.paths)).then((result) => !cancelled && setExact(result));
    return () => {
      cancelled = true;
    };
  }, [active]);
  return exact;
}
