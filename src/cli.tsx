import path from 'node:path';
import { parseArgs } from 'node:util';
import { defaultConfigFiles, loadConfig } from './config/load.ts';
import { GROUP_ORDER, IMPACTS, type Target, human, tildify, which } from './core/index.ts';
import { pluginsFrom } from './engine/build.ts';
import { overlapIndex, uniqueSize } from './engine/overlap.ts';
import { scanAll } from './engine/scan.ts';

const HELP = `putzteufel [ROOTS...] [options]

Fullscreen TUI that finds regenerable dev clutter and removes it, preferring each tool's own clean command.

  ROOTS                 directories to scan for project clutter (default: settings.roots, else cwd)
  --config FILE         extra config module, repeatable (also read: ~/.config/putzteufel/config.mjs, ./putzteufel.config.mjs)
  --list                print what would be cleaned and exit, no TUI
  --plugins             list plugins and config errors, then exit
  --older-than DAYS     preselect only items untouched for DAYS (--list hides younger ones)
  --exclude GLOB        skip paths matching GLOB, repeatable
  --no-projects         skip the project scan
  --no-caches           skip cache plugins
  --ascii               ASCII glyphs only, for terminals without Unicode block characters
  -h, --help`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: 'string', multiple: true, default: [] },
      list: { type: 'boolean', default: false },
      plugins: { type: 'boolean', default: false },
      'older-than': { type: 'string' },
      exclude: { type: 'string', multiple: true, default: [] },
      'no-projects': { type: 'boolean', default: false },
      'no-caches': { type: 'boolean', default: false },
      ascii: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const config = await loadConfig([...defaultConfigFiles(), ...values.config]);

  const roots = positionals.length ? positionals.map((r) => path.resolve(r)) : config.settings.roots.length ? config.settings.roots : [process.cwd()];
  const plugins = pluginsFrom(config.plugins, { projects: !values['no-projects'], items: !values['no-caches'] });
  const ctx = {
    roots,
    exclude: [...config.settings.exclude, ...values.exclude],
    olderThan: values['older-than'] === undefined ? config.settings.olderThan : Number(values['older-than']),
    recentDays: config.settings.recentDays,
  };

  if (values.plugins) {
    console.log(`config files: ${config.sources.map(tildify).join(', ') || 'none'}`);
    const rank = (group: string) => (GROUP_ORDER.includes(group) ? GROUP_ORDER.indexOf(group) : GROUP_ORDER.length);
    for (const def of [...config.plugins].sort((a, b) => rank(a.group) - rank(b.group) || a.name.localeCompare(b.name))) {
      const parts = [...(def.projects ?? []).map((r) => `${r.name} (in projects)`), ...(def.items ?? []).map((i) => i.name)];
      const tools: string[] = [];
      for (const item of def.items ?? []) {
        if (!item.tool || tools.some((t) => t.startsWith(item.tool!.bin))) continue;
        tools.push((await which(item.tool.bin)) ? item.tool.bin : `${item.tool.bin} not installed${item.tool.install ? `, offers ${item.tool.install}` : ''}`);
      }
      console.log(`${def.group.padEnd(18)} ${def.name.padEnd(14)} ${parts.join(', ')}${tools.length ? `  tool: ${tools.join(', ')}` : ''}`);
    }
    config.errors.forEach((e) => console.error(`error: ${e}`));
    return config.errors.length ? 1 : 0;
  }

  if (values.list) {
    const found: Target[] = [];
    await scanAll(plugins, { ...ctx, signal: new AbortController().signal }, (t) => (t.ageDays !== undefined && t.ageDays < ctx.olderThan ? undefined : found.push(t)), (m) => console.error(`warning: ${m}`));
    found.sort((a, b) => a.group.localeCompare(b.group) || a.plugin.localeCompare(b.plugin) || (b.size ?? 0) - (a.size ?? 0));
    const overlap = overlapIndex(found);
    for (const t of found) {
      const cover = overlap.coveredBy(t);
      const shared = cover ? `  (counted under ${cover.plugin})` : '';
      const age = t.ageDays === undefined ? '' : `${Math.floor(t.ageDays)}d`;
      const paths = t.paths.filter((p) => p !== t.label).map((p) => (p.startsWith(t.label + path.sep) ? path.relative(t.label, p) : tildify(p)));
      const via = t.commands.length ? `  via: ${t.commands[0].run}` : t.tool && !t.tool.installed && t.tool.clean.length ? `  ${t.tool.bin} ${t.tool.broken ? `failed (${t.tool.broken})` : 'not installed'}: deleted directly${t.tool.install && !t.tool.broken ? ` (or ${t.tool.install})` : ''}` : '';
      console.log(`${t.selected ? 'x' : ' '} ${human(t.size).padStart(7)} ${age.padStart(5)} ${IMPACTS[t.impact].tag.padEnd(11)}  ${t.group} / ${t.plugin}${t.item && t.item !== t.label ? ` / ${t.item}` : ''}  ${tildify(t.label)}${paths.length ? `  [${paths.join(', ')}]` : ''}${via}${shared}`);
    }
    const total = uniqueSize(found);
    const selected = uniqueSize(found.filter((t) => t.selected));
    console.log(`${human(total)} across ${found.length} items, ${human(selected)} selected by default`);
    config.errors.forEach((e) => console.error(`error: ${e}`));
    return 0;
  }

  const [{ createCliRenderer }, { createRoot }, { App }, { loadState, saveState }] = await Promise.all([import('@opentui/core'), import('@opentui/react'), import('./tui/App.tsx'), import('./config/state.ts')]);
  const state = await loadState();
  const renderer = await createCliRenderer({ screenMode: 'alternate-screen', useMouse: true, exitOnCtrlC: true });
  createRoot(renderer).render(
    <App
      plugins={plugins}
      ctx={ctx}
      configErrors={config.errors}
      hooks={config.settings.hooks}
      icons={values.ascii ? 'ascii' : (config.settings.icons ?? 'unicode')}
      theme={state.theme ?? config.settings.theme}
      firstRun={!state.welcomed}
      onSaveState={(patch) => void saveState(patch)}
      onExit={() => renderer.destroy()}
    />,
  );
  await renderer.closed;
  process.exit(0);
  return 0;
}
