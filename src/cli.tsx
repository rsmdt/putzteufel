import path from 'node:path';
import { parseArgs } from 'node:util';
import { render } from 'ink';
import React from 'react';
import { defaultConfigFiles, loadConfig } from './config.ts';
import { type Plugin, type Target, human, tildify } from './core.ts';
import { SpecPlugin } from './plugins.ts';
import { ProjectsPlugin } from './projects.ts';
import { scanAll } from './scan.ts';
import { App } from './tui.tsx';

const HELP = `putzteufel [ROOTS...] [options]

Fullscreen TUI that finds regenerable dev clutter and removes it, preferring each tool's own clean command.

  ROOTS                 directories to scan for project clutter (default: settings.roots, else cwd)
  --config FILE         extra config module, repeatable (also read: ~/.config/putzteufel/config.mjs, ./putzteufel.config.mjs)
  --list                print what would be cleaned and exit, no TUI
  --plugins             list plugins and config errors, then exit
  --older-than DAYS     only projects whose sources are untouched for DAYS
  --exclude GLOB        skip paths matching GLOB, repeatable
  --no-projects         skip the project scan
  --no-caches           skip cache plugins
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
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const config = await loadConfig([...defaultConfigFiles(), ...values.config]);

  const roots = positionals.length ? positionals.map((r) => path.resolve(r)) : config.settings.roots.length ? config.settings.roots : [process.cwd()];
  const plugins: Plugin[] = [
    ...(values['no-projects'] ? [] : [new ProjectsPlugin(config.rules)]),
    ...(values['no-caches'] ? [] : config.plugins.map((spec) => new SpecPlugin(spec))),
  ];
  const ctx = {
    roots,
    exclude: [...config.settings.exclude, ...values.exclude],
    olderThan: values['older-than'] === undefined ? config.settings.olderThan : Number(values['older-than']),
    recentDays: config.settings.recentDays,
  };

  if (values.plugins) {
    console.log(`config files: ${config.sources.map(tildify).join(', ') || 'none'}`);
    console.log(`project rules: ${config.rules.map((r) => r.name).join(', ')}`);
    for (const plugin of plugins) {
      console.log(`${(await plugin.available()) ? '✓' : '·'} ${plugin.category.padEnd(32)} ${plugin.name}`);
    }
    config.errors.forEach((e) => console.error(`error: ${e}`));
    return config.errors.length ? 1 : 0;
  }

  if (values.list) {
    const found: Target[] = [];
    await scanAll(plugins, { ...ctx, signal: new AbortController().signal }, (t) => found.push(t), (m) => console.error(`warning: ${m}`));
    found.sort((a, b) => a.category.localeCompare(b.category) || a.plugin.localeCompare(b.plugin) || (b.size ?? 0) - (a.size ?? 0));
    for (const t of found) {
      const age = t.ageDays === undefined ? '' : `${Math.floor(t.ageDays)}d`;
      const paths = t.paths.filter((p) => p !== t.label).map((p) => (p.startsWith(t.label + path.sep) ? path.relative(t.label, p) : tildify(p)));
      const via = t.commands.length ? `  via: ${t.commands[0].run}` : '';
      console.log(`${t.selected ? 'x' : ' '} ${human(t.size).padStart(7)} ${age.padStart(5)}  ${t.category} / ${t.plugin}  ${tildify(t.label)}${paths.length ? `  [${paths.join(', ')}]` : ''}${via}`);
    }
    const total = found.reduce((n, t) => n + (t.size ?? 0), 0);
    const selected = found.filter((t) => t.selected).reduce((n, t) => n + (t.size ?? 0), 0);
    console.log(`${human(total)} across ${found.length} items, ${human(selected)} selected by default`);
    config.errors.forEach((e) => console.error(`error: ${e}`));
    return 0;
  }

  const instance = render(<App plugins={plugins} ctx={ctx} configErrors={config.errors} />, { alternateScreen: true, exitOnCtrlC: true });
  await instance.waitUntilExit();
  process.exit(0);
  return 0;
}
