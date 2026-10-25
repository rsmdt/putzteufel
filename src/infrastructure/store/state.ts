import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

interface UiState {
  welcomed?: boolean;
  theme?: string;
}

export function statePath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'putzteufel', 'state.json');
}

export async function loadState(): Promise<UiState> {
  return readFile(statePath(), 'utf8').then(
    (text) => JSON.parse(text) as UiState,
    () => ({}),
  );
}

export async function saveState(patch: UiState): Promise<void> {
  const file = statePath();
  const next = { ...(await loadState()), ...patch };
  await mkdir(path.dirname(file), { recursive: true })
    .then(() => writeFile(file, `${JSON.stringify(next, null, 2)}\n`))
    .catch(() => undefined);
}
