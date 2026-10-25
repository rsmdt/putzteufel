import { GROUPS } from '../domain/groups.ts';
import { type TargetDraft } from '../domain/types.ts';
import { shell } from '../infrastructure/shell.ts';
import { definePlugin } from './api.ts';

type Row = Record<string, string>;

const UNITS: Record<string, number> = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 };

function parseSize(text = ''): number | undefined {
  const match = /([\d.]+)\s*([kKMGT]?B)/.exec(text);
  return match ? Math.round(Number.parseFloat(match[1]) * UNITS[match[2].toUpperCase()]) : undefined;
}

function ageInDays(created = '', now = Date.now()): number | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?/.exec(created.trim());
  if (!match) return undefined;
  const zone = !match[3] || match[3] === 'Z' ? 'Z' : match[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  const at = Date.parse(`${match[1]}T${match[2]}${zone}`);
  return Number.isNaN(at) ? undefined : Math.max(0, (now - at) / 86_400_000);
}

async function running(signal?: AbortSignal): Promise<boolean> {
  return shell('docker info >/dev/null 2>&1 && echo up', undefined, 30_000, signal).then(
    (out) => out.trim() === 'up',
    () => false,
  );
}

async function rows(command: string, signal?: AbortSignal): Promise<Row[]> {
  const out = await shell(command, undefined, undefined, signal).catch(() => '');
  return out
    .split('\n')
    .filter((l) => l.trim().startsWith('{'))
    .map((l) => JSON.parse(l) as Row);
}

async function lines(command: string, signal?: AbortSignal): Promise<string[]> {
  return (await shell(command, undefined, undefined, signal).catch(() => ''))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

async function usedImages(signal?: AbortSignal): Promise<Set<string>> {
  return new Set(await lines(`docker ps -aq | xargs docker inspect --format '{{.Image}}' 2>/dev/null`, signal));
}

async function images(dangling: boolean, signal?: AbortSignal): Promise<TargetDraft[]> {
  if (!(await running(signal))) return [];
  const used = await usedImages(signal);
  const all = await rows(`docker images --no-trunc ${dangling ? '-f dangling=true ' : ''}--format '{{json .}}'`, signal);
  return all
    .filter((i) => !used.has(i.ID) && (dangling || i.Repository !== '<none>'))
    .map((i) => {
      const name = i.Repository === '<none>' ? i.ID.replace('sha256:', '').slice(0, 12) : `${i.Repository}:${i.Tag}`;
      return { label: name, listed: [`${name}  ${i.CreatedSince ?? ''}  ${i.Size}`], size: parseSize(i.Size), ageDays: ageInDays(i.CreatedAt), commands: [{ run: `docker rmi ${i.ID}` }] };
    });
}

async function stoppedContainers(signal?: AbortSignal): Promise<TargetDraft[]> {
  if (!(await running(signal))) return [];
  const all = await rows(`docker ps -a -s --filter status=exited --filter status=created --filter status=dead --format '{{json .}}'`, signal);
  return all.map((c) => ({
    label: c.Names,
    listed: [`${c.Names}  ${c.Image}  ${c.Status}  ${c.Size}`],
    size: parseSize(c.Size),
    ageDays: ageInDays(c.CreatedAt),
    commands: [{ run: `docker rm ${c.ID}` }],
  }));
}

async function created(kind: 'volume' | 'network', names: string[], field: string, signal?: AbortSignal): Promise<Map<string, string>> {
  if (!names.length) return new Map();
  const out = await lines(`docker ${kind} inspect --format '{{.Name}}|{{.${field}}}' ${names.map((n) => `'${n}'`).join(' ')}`, signal);
  return new Map(out.map((l) => l.split('|') as [string, string]));
}

async function unusedVolumes(signal?: AbortSignal): Promise<TargetDraft[]> {
  if (!(await running(signal))) return [];
  const names = (await rows(`docker volume ls -f dangling=true --format '{{json .}}'`, signal)).map((v) => v.Name);
  const dates = await created('volume', names, 'CreatedAt', signal);
  return names.map((name) => ({ label: name, listed: [`volume ${name}`], ageDays: ageInDays(dates.get(name)), commands: [{ run: `docker volume rm '${name}'` }] }));
}

async function unusedNetworks(signal?: AbortSignal): Promise<TargetDraft[]> {
  if (!(await running(signal))) return [];
  const used = new Set(await lines(`docker ps -aq | xargs docker inspect --format '{{range .NetworkSettings.Networks}}{{.NetworkID}} {{end}}' 2>/dev/null | tr ' ' '\\n'`, signal));
  const custom = (await rows(`docker network ls --no-trunc --filter type=custom --format '{{json .}}'`, signal)).filter((n) => !used.has(n.ID));
  const dates = await created('network', custom.map((n) => n.Name), 'Created', signal);
  return custom.map((n) => ({ label: n.Name, listed: [`network ${n.Name}  ${n.Driver}`], ageDays: ageInDays(dates.get(n.Name)), commands: [{ run: `docker network rm ${n.ID}` }] }));
}

export default definePlugin({
  name: 'Docker',
  group: GROUPS.containers,
  description: 'Everything Docker keeps: build cache, containers, images, volumes and networks, each listed and removed with docker itself.',
  items: [
    { name: 'Build cache', requires: ['docker'], list: `if docker info >/dev/null 2>&1; then docker buildx du 2>/dev/null | tail -n 1; fi`, clean: 'docker builder prune -af {until}', impact: 'rebuild', description: 'Layer cache; the next docker build runs every step again. With an age threshold only cache older than it is pruned.' },
    { name: 'Stopped containers', requires: ['docker'], scan: (ctx) => stoppedContainers(ctx.signal), impact: 'dataloss', description: 'Anything written inside these containers is lost.' },
    { name: 'Dangling images', requires: ['docker'], scan: (ctx) => images(true, ctx.signal), description: 'Untagged leftovers of earlier builds.' },
    { name: 'Unused images', requires: ['docker'], scan: (ctx) => images(false, ctx.signal), impact: 'redownload', description: 'Images no container uses; pulled again on next run.' },
    { name: 'Unused volumes', requires: ['docker'], scan: (ctx) => unusedVolumes(ctx.signal), impact: 'dataloss', description: 'Volumes no container references. Their data is lost.' },
    { name: 'Unused networks', requires: ['docker'], scan: (ctx) => unusedNetworks(ctx.signal), description: 'Custom networks no container is attached to.' },
  ],
});
