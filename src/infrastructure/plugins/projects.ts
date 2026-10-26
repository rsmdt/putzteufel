import { tildify } from '../../domain/paths.ts';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { type Emit, type Plugin, type ScanContext, type Target } from '../../domain/types.ts';
import { HOME, matchesAny, wildcard } from '../../domain/paths.ts';
import { measure } from '../measure.ts';
import { execFileAsync, limiter, which } from '../shell.ts';
import { exists } from '../fs.ts';
import { type Owner, type ProjectRule } from '../../plugins/api.ts';

type OwnedRule = ProjectRule & Owner;

const NEVER_ENTER = new Set(['.git', '.hg', '.svn']);
const UNGUARDED = new Set(['node_modules', '__pycache__', '__pypackages__']);
const PROTECTED = [path.join(HOME, 'Library'), path.join(HOME, '.Trash'), '/System', '/Library', '/Applications'];
const CACHE_TAG = 'CACHEDIR.TAG';
const CACHE_TAG_SIGNATURE = 'Signature: 8a477f597d28d172789f06886806bc55';
const INSTALL_RECORDS = [
  ['package-lock.json', '.package-lock.json'],
  ['npm-shrinkwrap.json', '.package-lock.json'],
  ['pnpm-lock.yaml', '.modules.yaml'],
  ['yarn.lock', '.yarn-integrity'],
  ['yarn.lock', '.yarn-state.yml'],
];

function isProtected(p: string): boolean {
  return PROTECTED.some((root) => p === root || p.startsWith(root + path.sep));
}

async function keptByGit(dir: string, name: string): Promise<boolean> {
  if (name.startsWith('.') || UNGUARDED.has(name)) return false;
  return execFileAsync('git', ['-C', dir, 'check-ignore', '-q', '--', name], { timeout: 15_000 }).then(
    () => false,
    (e: { code?: number | string }) => e.code === 1,
  );
}

async function isCacheTag(p: string): Promise<boolean> {
  const file = await open(p).catch(() => null);
  if (!file) return false;
  try {
    const head = Buffer.alloc(CACHE_TAG_SIGNATURE.length);
    await file.read(head, 0, head.length, 0);
    return head.toString() === CACHE_TAG_SIGNATURE;
  } finally {
    await file.close();
  }
}

const isFile = (p: string) => lstat(p).then((s) => s.isFile(), () => false);

async function installRecord(nodeModules: string): Promise<string | undefined> {
  const project = path.dirname(nodeModules);
  for (const [lock, record] of INSTALL_RECORDS) {
    if ((await isFile(path.join(project, lock))) && (await isFile(path.join(nodeModules, record)))) return path.join(nodeModules, record);
  }
  return undefined;
}

async function changedAfterInstall(nodeModules: string): Promise<string | undefined> {
  const record = await installRecord(nodeModules);
  if (!record) return `${tildify(nodeModules)} has no lockfile and install record, so it may hold packages added by hand`;
  const newer = await execFileAsync('find', [nodeModules, '-path', path.join(nodeModules, '.cache'), '-prune', '-o', '-type', 'f', '-newer', record, '-print', '-quit'], { timeout: 60_000 }).then(
    (r) => r.stdout.trim(),
    () => null,
  );
  if (newer === null) return `Could not check ${tildify(nodeModules)} for changes made after the last install`;
  return newer ? `${tildify(newer)} changed after the last install` : undefined;
}

async function processFolders(): Promise<string[]> {
  if (!(await which('lsof'))) return [];
  const out = await execFileAsync('lsof', ['-nP', '-a', '-u', String(process.getuid?.() ?? ''), '-d', 'cwd', '-Fpn'], { timeout: 15_000, maxBuffer: 16 * 1024 * 1024 }).then(
    (r) => r.stdout,
    (e: { stdout?: string }) => e.stdout ?? '',
  );
  const folders: string[] = [];
  let pid = 0;
  for (const line of out.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && pid !== process.pid) folders.push(line.slice(1));
  }
  return folders;
}

async function hasMarker(dir: string, files: string[], markers: string[]): Promise<boolean> {
  if (!markers.length) return true;
  for (const marker of markers) {
    if (marker.includes('/') ? await exists(path.join(dir, marker)) : files.some((f) => wildcard(marker).test(f))) return true;
  }
  return false;
}

async function ruleMatches(rule: ProjectRule, dir: string, dirs: string[], files: string[]): Promise<string[]> {
  if (rule.contains?.length) {
    const matched: string[] = [];
    for (const d of dirs) {
      const checks = await Promise.all(rule.contains.map((c) => (c === CACHE_TAG ? isCacheTag : exists)(path.join(dir, d, c))));
      if (checks.every(Boolean)) matched.push(path.join(dir, d));
    }
    return matched;
  }
  if (!(await hasMarker(dir, files, rule.markers ?? []))) return [];
  const matched: string[] = [];
  for (const pattern of rule.dirs ?? []) {
    if (pattern.includes('/')) {
      const nested = path.join(dir, pattern);
      if ((await lstat(nested).catch(() => null))?.isDirectory()) matched.push(nested);
    } else {
      const re = wildcard(pattern);
      matched.push(...dirs.filter((d) => re.test(d)).map((d) => path.join(dir, d)));
    }
  }
  return matched;
}

const ruleKey = (rule: OwnedRule) => `${rule.plugin}/${rule.name}`;

export class ProjectsScanner implements Plugin {
  name = 'Projects';
  group = 'Projects';
  owners: string[];
  description = 'Dependency and build folders inside project directories';
  private cleanable = new Map<string, boolean>();
  private newest = new Map<string, Promise<number>>();
  private statLimit = limiter(64);
  private rootMarkers: string[];
  private workingFolders: Promise<string[]> = Promise.resolve([]);

  constructor(private rules: OwnedRule[]) {
    this.owners = [...new Set(rules.map((r) => r.plugin))];
    this.rootMarkers = ['.git', ...new Set(rules.flatMap((r) => r.markers ?? []).filter((m) => !/[*?]/.test(m)))];
  }

  async available(): Promise<boolean> {
    for (const rule of this.rules) {
      const tools = await Promise.all((rule.requires ?? []).map(which));
      this.cleanable.set(ruleKey(rule), Boolean(rule.clean) && tools.every(Boolean));
    }
    return this.rules.length > 0;
  }

  async scan(ctx: ScanContext, emit: Emit): Promise<void> {
    const claimed = new Set<string>();
    this.workingFolders = processFolders();
    for (const root of ctx.roots) {
      const queue = [root];
      let active = 0;
      await new Promise<void>((resolve) => {
        const pump = () => {
          if (ctx.signal.aborted || (!queue.length && !active)) return resolve();
          while (active < 32 && queue.length) {
            const dir = queue.pop()!;
            active++;
            this.visit(dir, root, ctx, emit, claimed, queue)
              .catch(() => undefined)
              .finally(() => {
                active--;
                pump();
              });
          }
        };
        pump();
      });
    }
  }

  private visited = 0;

  private async visit(dir: string, root: string, ctx: ScanContext, emit: Emit, claimed: Set<string>, queue: string[]): Promise<void> {
    if (++this.visited % 25 === 0) ctx.note?.(`${this.visited} folders walked, ${queue.length} queued; now in ${tildify(dir)}`);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const files = entries.filter((e) => !e.isDirectory()).map((e) => e.name);
    const found = new Set<string>();
    for (const rule of this.rules) {
      const candidates = (await ruleMatches(rule, dir, dirs, files)).filter((p) => !claimed.has(p) && !found.has(p) && !isProtected(p) && !matchesAny(p, ctx.exclude));
      const paths: string[] = [];
      for (const p of candidates) {
        if (!(await keptByGit(path.dirname(p), path.basename(p)))) paths.push(p);
      }
      if (!paths.length) continue;
      paths.forEach((p) => found.add(p));
      emit({
        plugin: rule.plugin,
        group: rule.group,
        item: rule.name,
        label: dir,
        paths,
        project: await this.projectRoot(dir, root),
        impact: rule.impact ?? 'rebuild',
      note: rule.description,
        commands: this.cleanable.get(ruleKey(rule)) ? [{ run: rule.clean!, cwd: dir }] : [],
        tool: rule.clean ? { bin: rule.requires?.[0] ?? rule.clean.split(' ')[0], installed: Boolean(this.cleanable.get(ruleKey(rule))), clean: [{ run: rule.clean, cwd: dir }] } : undefined,
        hooks: rule.hooks,
      });
    }
    found.forEach((p) => claimed.add(p));
    for (const d of dirs) {
      const child = path.join(dir, d);
      if (!NEVER_ENTER.has(d) && !claimed.has(child) && !isProtected(child) && !matchesAny(child, ctx.exclude)) queue.push(child);
    }
  }

  async measure(target: Target): Promise<void> {
    const sized = await measure(target.paths);
    target.size = sized.size;
    target.linkedBytes = sized.linkedBytes;
    target.partial = sized.partial;
    const newest = target.project ? await this.newestSourceMtime(target.project) : 0;
    const fallback = newest || (await lstat(target.paths[0]).then((s) => s.mtimeMs, () => Date.now()));
    target.ageDays = (Date.now() - fallback) / 86_400_000;
    const caution = await this.caution(target);
    if (caution) {
      target.impact = 'unknown';
      target.note = target.note ? `${caution}. ${target.note}` : caution;
    }
  }

  private async caution(target: Target): Promise<string | undefined> {
    if (target.project) {
      const project = await realpath(target.project).catch(() => target.project!);
      if ((await this.workingFolders).some((f) => f === project || f.startsWith(project + path.sep))) return `A process is running in ${tildify(target.project)}`;
    }
    for (const p of target.paths.filter((p) => path.basename(p) === 'node_modules')) {
      const change = await changedAfterInstall(p);
      if (change) return change;
    }
    return undefined;
  }

  private async projectRoot(dir: string, scanRoot: string): Promise<string> {
    for (let candidate = dir; ; candidate = path.dirname(candidate)) {
      for (const marker of this.rootMarkers) {
        if (await exists(path.join(candidate, marker))) return candidate;
      }
      if (candidate === scanRoot || candidate === path.dirname(candidate)) return dir;
    }
  }

  private isJunk(dir: string, name: string): Promise<boolean> {
    if (NEVER_ENTER.has(name)) return Promise.resolve(true);
    const flat = this.rules.map((r) => ({ ...r, markers: [], dirs: (r.dirs ?? []).filter((d) => !d.includes('/')) }));
    return Promise.all(flat.map((r) => ruleMatches(r, dir, [name], []))).then((m) => m.some((x) => x.length > 0));
  }

  private newestSourceMtime(project: string): Promise<number> {
    if (!this.newest.has(project)) {
      const walk = async (dir: string): Promise<number> => {
        const entries = await this.statLimit(() => readdir(dir, { withFileTypes: true }).catch(() => []));
        const times = await Promise.all(
          entries.map(async (e) => {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) return (await this.isJunk(dir, e.name)) ? 0 : walk(full);
            return this.statLimit(() => lstat(full).then((s) => s.mtimeMs, () => 0));
          }),
        );
        return Math.max(0, ...times);
      };
      this.newest.set(project, walk(project));
    }
    return this.newest.get(project)!;
  }
}
