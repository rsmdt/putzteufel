import { type Hooks, type Target, type Tool, cleanTarget, forgetWhich, shell, tildify, which } from './core.ts';

export const INSTALL_TIMEOUT = 30 * 60_000;

export interface RunPlan {
  targets: Target[];
  install: Tool[];
  uninstallAfter: boolean;
  hooks: Hooks;
  useTrash: boolean;
}

export interface RunResult {
  freed: number;
  cleaned: Set<number>;
}

export function missingTools(targets: Target[]): Tool[] {
  const tools = new Map<string, Tool>();
  for (const t of targets) if (t.tool && !t.tool.installed && !t.tool.broken && t.tool.install && !tools.has(t.tool.bin)) tools.set(t.tool.bin, t.tool);
  return [...tools.values()];
}

export type Action = { kind: 'commands'; commands: Target['commands']; afterInstall?: string } | { kind: 'delete'; missing?: string };

export function actionFor(t: Target, install: Set<string>): Action {
  if (t.commands.length) return { kind: 'commands', commands: t.commands };
  if (t.tool && !t.tool.installed && install.has(t.tool.bin)) return { kind: 'commands', commands: t.tool.clean, afterInstall: t.tool.install };
  return { kind: 'delete', missing: t.tool && !t.tool.installed && t.tool.clean.length ? t.tool.bin : undefined };
}

async function hook(label: string, command: string | undefined, log: (line: string) => void): Promise<boolean> {
  if (!command) return true;
  log(`… ${label}: ${command}`);
  return shell(command).then(
    () => (log(`✓ ${label}`), true),
    (e: Error & { stderr?: string }) => (log(`✗ ${label}: ${(e.stderr || e.message).trim().slice(-400)}`), false),
  );
}

export async function runClean(plan: RunPlan, log: (line: string) => void): Promise<RunResult> {
  const result: RunResult = { freed: 0, cleaned: new Set() };
  if (!(await hook('before hook', plan.hooks.before, log))) {
    log('Stopped: the before hook failed, nothing was removed.');
    return result;
  }

  const installed = new Set<string>();
  for (const tool of plan.install) {
    log(`… installing ${tool.bin}: ${tool.install}`);
    const ok = await shell(tool.install!, undefined, INSTALL_TIMEOUT).then(
      () => true,
      (e: Error & { stderr?: string }) => (log(`✗ install ${tool.bin}: ${(e.stderr || e.message).trim().slice(-400)}`), false),
    );
    forgetWhich();
    if (ok && (await which(tool.bin))) {
      installed.add(tool.bin);
      log(`✓ installed ${tool.bin}`);
    } else if (ok) log(`✗ install ${tool.bin}: finished, but ${tool.bin} is still not on PATH`);
  }
  const failed = new Set(plan.install.map((t) => t.bin).filter((bin) => !installed.has(bin)));

  const groups = new Map<string, Target[]>();
  for (const t of plan.targets) groups.set(t.plugin, [...(groups.get(t.plugin) ?? []), t]);
  for (const [plugin, targets] of groups) {
    const hooks = targets[0].hooks ?? {};
    if (!(await hook(`${plugin} before hook`, hooks.before, log))) {
      log(`  skipped ${targets.length} item(s) of ${plugin}`);
      continue;
    }
    for (const t of targets) {
      if (t.tool && failed.has(t.tool.bin)) {
        log(`✗ ${tildify(t.label)}: skipped, ${t.tool.bin} could not be installed`);
        continue;
      }
      const action = actionFor(t, installed);
      log(`… ${tildify(t.label)}`);
      const failures = await cleanTarget({ ...t, commands: action.kind === 'commands' ? action.commands : [] }, plan.useTrash);
      if (failures.length) failures.forEach((f) => log(`✗ ${f}`));
      else {
        result.freed += t.size ?? 0;
        result.cleaned.add(t.id);
        log(`✓ ${tildify(t.label)}`);
      }
    }
    await hook(`${plugin} after hook`, hooks.after, log);
  }

  if (plan.uninstallAfter) {
    for (const tool of plan.install.filter((t) => installed.has(t.bin) && t.uninstall)) {
      log(`… uninstalling ${tool.bin}: ${tool.uninstall}`);
      await shell(tool.uninstall!, undefined, INSTALL_TIMEOUT).then(
        () => log(`✓ uninstalled ${tool.bin}`),
        (e: Error & { stderr?: string }) => log(`✗ uninstall ${tool.bin}: ${(e.stderr || e.message).trim().slice(-400)}`),
      );
    }
    forgetWhich();
  }
  await hook('after hook', plan.hooks.after, log);
  return result;
}
