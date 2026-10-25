import { appendFile, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface Operation {
  at: string;
  plugin: string;
  item?: string;
  label: string;
  result: 'done' | 'failed' | 'skipped';
  paths?: { path: string; how: 'delete' | 'trash' }[];
  commands?: string[];
  bytes?: number;
  detail?: string;
}

function operationsLogPath(): string {
  if (process.env.PUTZTEUFEL_LOG) return process.env.PUTZTEUFEL_LOG;
  return process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Logs', 'putzteufel', 'operations.log')
    : path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'putzteufel', 'operations.log');
}

export async function logOperation(operation: Operation): Promise<void> {
  const file = operationsLogPath();
  await mkdir(path.dirname(file), { recursive: true })
    .then(() => appendFile(file, `${JSON.stringify(operation)}\n`))
    .catch(() => undefined);
}

export async function readOperations(): Promise<Operation[]> {
  const text = await readFile(operationsLogPath(), 'utf8').catch(() => '');
  return text
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Operation];
      } catch {
        return [];
      }
    });
}
