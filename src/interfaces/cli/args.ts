import { parseArgs } from 'node:util';
import { type InstallChoice } from '../../domain/plan.ts';
import { type Selector } from '../../domain/select.ts';
import { type SessionOptions } from '../../application/session.ts';
import { IMPACT_ORDER } from '../../domain/impact.ts';
import { type Impact } from '../../domain/types.ts';
import { type Decision } from '../../domain/run-plan.ts';

const list = () => ({ type: 'string' as const, multiple: true as const, default: [] as string[] });
const flag = () => ({ type: 'boolean' as const, default: false });
const text = (fallback?: string) => ({ type: 'string' as const, ...(fallback === undefined ? {} : { default: fallback }) });

export const OPTIONS = {
  config: list(),
  json: flag(),
  'older-than': text(),
  exclude: list(),
  'no-projects': flag(),
  'no-caches': flag(),
  only: list(),
  key: list(),
  'exclude-key': list(),
  plugin: list(),
  item: list(),
  group: list(),
  impact: list(),
  filter: text(),
  all: flag(),
  default: flag(),
  trash: flag(),
  'install-tools': text('none'),
  'uninstall-after': flag(),
  'on-failure': text('skip'),
  yes: flag(),
  dir: text(),
  sort: text('size'),
  reverse: flag(),
  limit: text(),
  list: flag(),
  plugins: flag(),
  ascii: flag(),
  help: { ...flag(), short: 'h' },
};

export function parse(argv: string[]) {
  return parseArgs({ args: argv, allowPositionals: true, options: OPTIONS });
}

export type Values = ReturnType<typeof parse>['values'];

export class UsageError extends Error {}

export function number(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new UsageError(`--${name} must be a number of days or items, got "${value}"`);
  return n;
}

export function sessionOptions(values: Values, roots: string[]): SessionOptions {
  return { roots, configFiles: values.config, olderThan: number(values['older-than'], 'older-than'), exclude: values.exclude, projects: !values['no-projects'], caches: !values['no-caches'], only: values.only };
}

export function selector(values: Values, minAge: number): Selector {
  const impacts = values.impact.map((i) => i.toLowerCase().replace(/[\s-]/g, '')) as Impact[];
  const unknown = impacts.filter((i) => !IMPACT_ORDER.includes(i));
  if (unknown.length) throw new UsageError(`--impact must be one of ${IMPACT_ORDER.join(', ')}; got ${unknown.join(', ')}`);
  return { keys: values.key, excludeKeys: values['exclude-key'], plugins: values.plugin, items: values.item, groups: values.group, impacts, filter: values.filter, all: values.all, defaults: values.default, olderThan: minAge };
}

export function installChoice(value: string): InstallChoice {
  if (value === 'all' || value === 'none') return value;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export interface FailurePolicy {
  decide: (attempt: number) => Decision;
}

export function failurePolicy(value: string): FailurePolicy {
  if (value === 'skip') return { decide: () => 'skip' };
  if (value === 'abort') return { decide: () => 'abort' };
  const retry = /^retry:(\d+)$/.exec(value);
  if (retry) return { decide: (attempt) => (attempt <= Number(retry[1]) ? 'retry' : 'skip') };
  throw new UsageError(`--on-failure must be skip, abort or retry:N; got "${value}"`);
}
