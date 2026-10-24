import path from 'node:path';
import { HOME } from './paths.ts';
import { type Target } from './types.ts';

export type Disposal = 'delete' | 'trash';

export interface CleanOptions {
  useTrash: boolean;
  trashAvailable: boolean;
  minAge?: number;
}

export interface Disposed {
  path: string;
  how: Disposal;
}

const TRASH_DIR = path.join(HOME, '.Trash');

export function disposalFor(target: Target, p: string, options: CleanOptions): Disposal {
  const insideTrash = p === TRASH_DIR || p.startsWith(TRASH_DIR + path.sep);
  return options.trashAvailable && !insideTrash && (options.useTrash || target.impact === 'dataloss') ? 'trash' : 'delete';
}
