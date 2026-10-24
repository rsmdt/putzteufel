import { createHash } from 'node:crypto';

export function targetKey(parts: { plugin: string; item?: string; label: string; paths: string[] }): string {
  return createHash('sha1')
    .update([parts.plugin, parts.item ?? '', parts.label, ...[...parts.paths].sort()].join('\0'))
    .digest('hex')
    .slice(0, 12);
}
