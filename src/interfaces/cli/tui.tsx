import { openSession } from '../../application/session.ts';
import { loadEstimates, saveEstimates } from '../../infrastructure/store/estimates.ts';
import { loadState, saveState } from '../../infrastructure/store/state.ts';
import { type Values, sessionOptions } from './args.ts';

export async function tuiCommand(values: Values, roots: string[]): Promise<number> {
  const session = await openSession(sessionOptions(values, roots));
  const [{ createCliRenderer }, { createRoot }, { App }] = await Promise.all([import('@opentui/core'), import('@opentui/react'), import('../tui/App.tsx')]);
  const [state, estimates] = await Promise.all([loadState(), loadEstimates()]);
  const renderer = await createCliRenderer({ screenMode: 'alternate-screen', useMouse: true, exitOnCtrlC: true }).catch((error: Error) => {
    const runtime = process.versions.bun ? `Bun ${process.versions.bun}` : `Node.js ${process.versions.node}`;
    console.error(`putzteufel: the fullscreen TUI cannot start on ${runtime}.\n${error.message}\nIt needs Node.js 26.4 or newer, or Bun 1.3.14 or newer (bunx putzteufel).`);
    return null;
  });
  if (!renderer) return 1;
  createRoot(renderer).render(
    <App
      plugins={session.plugins}
      ctx={session.ctx}
      configErrors={session.config.errors}
      hooks={session.config.settings.hooks}
      icons={values.ascii ? 'ascii' : (session.config.settings.icons ?? 'unicode')}
      theme={state.theme ?? session.config.settings.theme}
      firstRun={!state.welcomed}
      estimates={estimates}
      onScanned={(targets) => void saveEstimates(targets)}
      onSaveState={(patch) => void saveState(patch)}
      onExit={() => renderer.destroy()}
    />,
  );
  await renderer.closed;
  process.exit(0);
  return 0;
}
