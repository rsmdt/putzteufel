import { UsageError, parse } from './args.ts';
import { cleanCommand } from './commands/clean.ts';
import { filesCommand } from './commands/files.ts';
import { historyCommand } from './commands/history.ts';
import { planCommand } from './commands/plan.ts';
import { pluginsCommand } from './commands/plugins.ts';
import { scanCommand } from './commands/scan.ts';
import { toolsCommand } from './commands/tools.ts';
import { output } from './output.ts';

export const HELP = `putzteufel [ROOTS...]                 fullscreen TUI
putzteufel scan [ROOTS...]            list what can be cleaned (with keys)
putzteufel files KEY [ROOTS...]       list the files inside one item (--dir PATH to go deeper)
putzteufel plan [ROOTS...] [select]   show what a cleanup would do, nothing is removed
putzteufel clean [ROOTS...] [select] --yes
                                      clean the selected items
putzteufel tools [ROOTS...]           native tools the scan suggests installing; --install all|BIN,BIN --yes installs them
putzteufel plugins                    list plugins, tools and config errors
putzteufel history [--limit N]        cleanups recorded in the operations log

Selection (plan, clean, and the x column of scan; without any, the default selection is used):
  --key KEY           an item by key (repeatable)        --exclude-key KEY
  --plugin NAME       every item of a plugin             --item PLUGIN/ITEM
  --group NAME        an ecosystem, e.g. Python          --impact KIND   regenerates, rebuild, redownload, unknown, dataloss
  --filter TEXT       fuzzy filter on label, plugin, group and paths
  --default           add the default selection          --all           everything found
  --older-than DAYS   only items untouched for DAYS (also sets the age filter for Docker build cache)

Cleaning:
  --trash             move folders to the Trash instead of deleting them
  --install-tools all|none|BIN,BIN   install missing native tools with brew first (default none)
  --uninstall-after   uninstall the tools installed by this run afterwards
  --on-failure skip|abort|retry:N    what to do when an item fails (default skip)
  --yes               actually clean; without it, clean prints the plan and exits 3

Scanning:
  --config FILE       extra config module, repeatable
  --exclude GLOB      skip paths matching GLOB, repeatable
  --no-projects       skip the project scan        --no-caches     skip cache plugins
  --only PLUGIN       scan only these plugins, repeatable (faster, e.g. --only Docker)
  --sort size|age|name, --reverse   order of the scan list (default size)
  --json              newline-delimited JSON events for scripts and other UIs (with progress events every 2 s)
  --verbose           print each plugin scan and folder measurement as it starts and finishes, with its time
  --ascii             (TUI) ASCII glyphs only
  -h, --help

Exit codes: 0 ok, 1 error, 2 some cleanup steps failed, 3 clean needs --yes.`;

const COMMANDS = new Set(['scan', 'files', 'plan', 'clean', 'tools', 'plugins', 'history', 'tui']);

export async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const { values, positionals } = parse(argv);
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    const command = COMMANDS.has(positionals[0]) ? positionals[0] : values.list ? 'scan' : values.plugins ? 'plugins' : 'tui';
    const rest = COMMANDS.has(positionals[0]) ? positionals.slice(1) : positionals;
    const out = output(values.json);
    if (command === 'scan') return await scanCommand(values, rest, out);
    if (command === 'files') return await filesCommand(values, rest, out);
    if (command === 'plan') return await planCommand(values, rest, out);
    if (command === 'clean') return await cleanCommand(values, rest, out);
    if (command === 'tools') return await toolsCommand(values, rest, out);
    if (command === 'plugins') return await pluginsCommand(values, out);
    if (command === 'history') return await historyCommand(values, out);
    const { tuiCommand } = await import('./tui.tsx');
    return await tuiCommand(values, rest);
  } catch (e) {
    if (e instanceof UsageError || (e as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')) {
      console.error(`putzteufel: ${(e as Error).message}\nRun putzteufel --help for usage.`);
      return 1;
    }
    throw e;
  }
}
