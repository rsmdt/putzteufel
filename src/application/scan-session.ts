import { type Session } from './session.ts';
import { loadEstimates, saveEstimates } from '../infrastructure/store/estimates.ts';
import { type Target } from '../domain/types.ts';
import { scanAll } from './scan.ts';

export interface ScanHooks {
  onFound?: (t: Target) => void;
  onMeasured?: (t: Target) => void;
  onWarning: (message: string) => void;
}

export async function scanSession(session: Session, hooks: ScanHooks): Promise<Target[]> {
  const found: Target[] = [];
  const estimates = await loadEstimates();
  await scanAll(
    session.plugins,
    { ...session.ctx, signal: new AbortController().signal },
    (t) => {
      found.push(t);
      hooks.onMeasured?.(t);
    },
    hooks.onWarning,
    { estimates, onFound: hooks.onFound },
  );
  await saveEstimates(found);
  return found;
}
