import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Target } from '../../domain/types.ts';
import { type Estimate } from '../../domain/types.ts';
import { statePath } from './state.ts';

function estimatesPath(): string {
  return path.join(path.dirname(statePath()), 'sizes.json');
}

export async function loadEstimates(): Promise<Map<string, Estimate>> {
  const text = await readFile(estimatesPath(), 'utf8').catch(() => '{}');
  try {
    return new Map(Object.entries(JSON.parse(text) as Record<string, Estimate>));
  } catch {
    return new Map();
  }
}

export async function saveEstimates(targets: Target[]): Promise<void> {
  const at = Date.now();
  const data = Object.fromEntries(targets.filter((t) => !t.estimated && t.size !== undefined).map((t) => [t.key, { size: t.size, linkedBytes: t.linkedBytes, ageDays: t.ageDays, at }]));
  const file = estimatesPath();
  await mkdir(path.dirname(file), { recursive: true })
    .then(() => writeFile(file, JSON.stringify(data)))
    .catch(() => undefined);
}
