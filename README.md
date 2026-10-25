# putzteufel

Fullscreen terminal UI that finds regenerable developer clutter (project dependency and build folders, package-manager caches, Docker leftovers, Xcode data, editor caches) and removes it. Where a tool has its own cleanup command (`uv cache clean`, `npm cache clean --force`, `cargo clean`, `docker image prune`, `brew cleanup`, `xcrun simctl delete unavailable`, …) putzteufel runs that command instead of deleting files itself.

Requires [Bun](https://bun.sh) 1.3.14 or newer. The TUI is built on [OpenTUI](https://github.com/anomalyco/opentui) with its React renderer.

```sh
bun install
bun link                       # puts `putzteufel` on PATH
putzteufel                     # TUI: scan cwd for projects + all caches
putzteufel ~/Code --older-than 90
putzteufel scan                # plain dry run, no TUI (putzteufel --list still works)
putzteufel plugins             # which plugins are active, config errors
```

Layout: the header starts with a spinner that turns while putzteufel scans or cleans (a check when it is done) and a mode pill. While scanning, every row whose plugin is still looking or whose folder is being measured shows a spinner in place of its colored dot, and a row waiting for its turn to be measured shows `◌` (putzteufel measures 8 folders at a time, those that were small last time first), a plugin still looking for items appears right away as a `looking for items…` row, and the preview of the row reads like a log: `[INFO]` lines about the item first (what removing it costs, how it is cleaned, `[WARN]` for shared or hard-linked folders), then one line per scan step, shown with a spinner while it runs (`⠋ Measuring ~/Library/Caches/… · 22s`), with `◌` while it waits for a free slot, and with `✓` and how long it took once done (`✓ Looked for browsers: found 3 items · 1.4s`), and finally the files it holds (LIST, FILES, MAP, PREVIEW, FILTER, REVIEW, CLEANING, …) that says what your keys act on. Below it are the item list (or the file browser), the preview of the item at the cursor, and the disk map on the right. Each pane has a frame whose titles show the cursor position, the sort and the selection; the focused pane's frame is drawn in the pill's color. The line above the footer shows the latest message (warnings, results, mode changes); there is no separate message log, everything about a row is in its preview. The footer lists the keys for the current mode and drops the least important ones first when the window is narrow. Dialogs open over a dimmed screen.

Keys (`?` shows all of them, searchable with `/`, built from the same list the footer uses):

| key | action |
|---|---|
| `↑↓`/`jk`, `PgUp`/`PgDn`, `g`/`G` | move |
| `space` | select or deselect (a group toggles all its items) |
| `→`/`←` | expand or collapse a group |
| `enter`/`f` | browse an item's files; `←` goes up a level and lands on the folder you came from |
| `tab` / `shift+tab` | move focus between list, preview and map; in the map `←→` walk slices, `↑` goes out, `↓` goes in; in the preview `↑↓` scroll |
| `/` | fuzzy filter (`esc` clears) |
| `[` / `]` | lower or raise the age threshold |
| `o`, `R` | sort by size, age or name; reverse |
| `m` | map: sunburst, treemap, hidden |
| `i` | install suggested native tools now |
| `t` | delete vs. Trash mode |
| `d` | review and clean; `esc` stops a running cleanup |
| `T` | theme (dark, light, high contrast; previews live, saved on enter) |
| `r`, `q` | rescan, quit |

After you confirm the review, the dialog closes and the cleanup runs in the main screen. Every item being cleaned gets a bar at the right of its row: empty and `queued` while it waits, filling by bytes freed while putzteufel deletes a folder (it removes the entries inside one at a time; a dominant subfolder is split further), animated while a tool command runs or a folder moves to the Trash, and `✓ 4.0K`, `✗ failed` or `↷ skipped` at the end. The plugins being cleaned are expanded so the bars are visible, and the header shows `CLEANING` with how many items are done and how much is freed. The preview of a row logs each step that affects it below the scan steps, with a spinner and time while it runs: its own item, the hooks of its plugin and of the run, and the install and uninstall of its native tool. A failed item does not stop the run; it stays selected, so `d` again retries only what failed. Cleaned items are deselected and stay in the list with their bar until the next rescan. While the run is going, selection, the age threshold, `d`, `r`, `i`, `t` and `q` are locked; `esc` stops it: the running command is killed, a folder being deleted stops at the next entry, the remaining items are skipped, and uninstalls and the run's after hook still run. Each clean command may run for 30 minutes before it is stopped.

The disk map follows DaisyDisk: the sunburst shows ecosystems, plugins and items as rings around the center, with arc length proportional to size; the treemap shows the cursor's level as nested rectangles. Selected items are drawn in full color, unselected ones dimmed, so the map shows what will be freed. The map needs a terminal at least 90 columns wide; the header says so when it is hidden. Below 60×16 putzteufel shows the size it needs. `--ascii` (or `settings.icons: 'ascii'`) avoids Unicode block characters; `settings.icons: 'nerd'` adds Nerd Font category icons. The first run shows a short welcome; that and the chosen theme are remembered in `~/.config/putzteufel/state.json`.

Nothing is removed until you press `d`, read the confirmation screen listing every path, command and listed item, and press `y`. Before that, `enter` or `f` on an item opens a file browser with the size of every folder and file inside it; folders open with `enter`, `←` goes back up. An item is always removed as a unit.

Native tools: built-in plugins find their folders even when the tool that owns them is missing (they know each tool's default locations, and ask the tool itself when it is installed). The preview says which command will clean the item, or that the tool is missing and the folders will be deleted directly. When you press `d` and selected items have a missing tool that Homebrew can install, a screen lists those tools, all checked: checked tools are installed with `brew install` and do the cleanup with their own command, unchecked ones fall back to direct deletion. A checkbox at the bottom uninstalls the tools again after the cleanup (`brew uninstall` of that formula only; dependencies brew pulled in stay). The review screen lists every install, uninstall and hook command before you press `y`. If an install fails, that tool's items are skipped, not deleted.

Tool suggestions: while the scan runs, putzteufel proposes the native tools that would clean what it just found better than deleting folders, for example `cargo-cache` for the Cargo registry or `hf` for Hugging Face models. Each suggestion appears once in the message bar, and the header counts them (`2 tool suggestions (i)`). `i` opens a dialog to install the checked ones with `brew` right away; their items are then rescanned and use the tool. A checkbox there uninstalls them again after the next cleanup. Nothing is installed without that confirmation. On the command line, `putzteufel scan` lists the suggestions and `putzteufel tools --install BIN --yes` installs them.

Run order: `settings.hooks.before` (if it fails, nothing runs), installs, then per plugin its `hooks.before`, its items, its `hooks.after`, then uninstalls, then `settings.hooks.after`.

Age threshold: `[`/`]` step through any age, 1, 3, 7, 14, 30, 60, 90, 180 and 365 days, and reselect every item whose age is known: it is selected when it is older than the threshold, and deselected otherwise. `--older-than` or `settings.olderThan` sets the starting value. Projects are aged by their newest source file, other folders by their newest file at any depth, Docker images, containers, volumes and networks by when Docker created them. Docker's build cache is pruned with `--filter until=` set to the threshold. Items without a date (unavailable simulators, tool-reported lists) keep their selection.

Every item carries an impact tag that says what happens after it is removed. The preview under the list explains the tag and the item's own note, and says why the item is or is not selected; `?` shows the legend; the review screen totals the selection per tag.

| tag | meaning | selected by default |
|---|---|---|
| `regenerates` | the tool recreates it on its own when needed (`__pycache__`, package-manager caches) | yes |
| `rebuild` | the next install or build recreates it (`node_modules`, `target/`, DerivedData) | yes |
| `re-download` | fetched again from the network on next use (Hugging Face models, Playwright browsers, Go modules) | no |
| `unknown` | putzteufel cannot tell whether anything recreates it (`~/.cache/*`, `~/Library/Caches/*`, `dist/`) | no |
| `data loss` | cannot be recovered (Docker volumes and stopped containers, Xcode archives, Trash) | no |

Items younger than the age threshold and projects edited within `recentDays` (default 7) also start unselected, tagged `recent`.

## Command line and JSON

Everything the TUI does is also available without it, so scripts, schedules and other UIs can drive putzteufel:

```sh
putzteufel scan ~/Code                     # what can be cleaned; each row has a stable 12-character key
putzteufel files 3f9c2a1b7d04 ~/Code       # the files inside one item (--dir PATH to go deeper)
putzteufel plan --plugin Docker --older-than 30   # what a cleanup would do; nothing is removed
putzteufel clean --key 3f9c2a1b7d04 --trash --yes
putzteufel clean --impact regenerates --install-tools all --uninstall-after --on-failure retry:2 --yes
putzteufel tools --install cargo-cache --yes # install a suggested native tool
putzteufel plugins                         # plugins, their tools, config errors
putzteufel history                         # cleanups recorded in the operations log
```

Selection works the same for `scan` (the `x` column), `plan` and `clean`: `--key`, `--exclude-key`, `--plugin`, `--item Plugin/Item`, `--group`, `--impact`, `--filter` (fuzzy), `--all`, `--default` (the TUI's default selection, also used when nothing else is given) and `--older-than DAYS`. `--only PLUGIN` scans just those plugins, which is much faster. `--verbose` prints each plugin scan and folder measurement to stderr as it starts and finishes, with its time, which shows what a slow scan is waiting for. Nothing in a scan can hang forever: a tool's command is stopped after 2 minutes together with any child processes it started, a plugin that is still looking after 5 minutes is stopped and keeps what it found (`PUTZTEUFEL_PLUGIN_TIMEOUT_MS`), and a folder walk is stopped after 10 minutes with its size reported as a lower bound (`PUTZTEUFEL_WALK_TIMEOUT_MS`). Each stop shows up as a warning and in that row's scan log. `clean` without `--yes` prints the plan and exits with code 3; exit codes are 0 ok, 1 error, 2 some steps failed. Native tools are only installed with `--install-tools`.

With `--json`, every command writes newline-delimited JSON, one event per line, each with `"event"` and `"schema": 1`:

| command | events |
|---|---|
| `scan` | `progress` (every 2 s: `found`, `measured`, `waiting`, and `running` with `kind`, `label`, `detail`, `seconds`), `found` (an item, before measuring, possibly with `estimated` sizes from the last run), `measured`, `suggestion` (a tool to install: `bin`, `install`, `uninstall`, `clean`, `size`, `items` keys, `reason`), `warning`, `config-error`, `done` (`count`, `size`, `selectedSize`, `selected` keys, all `targets`) |
| `files` | `files` (`target`, `dir`, `entries` with `name`, `path`, `size`, `isDir`, `mtimeMs`, and `owners`: keys of other items that touch the entry) |
| `plan` | `plan` (`plan` with `size`, `notes`, `hooks`, `install`, `uninstall`, `items`; `exact` with `total` bytes on disk and `freed`, counting hard-linked files once) |
| `clean` | `step` (hooks, installs, items and uninstalls with `state` pending/running/done/failed/skipped; while a folder is deleted, repeated `running` events carry `progress` from 0 to 1, otherwise it is null), `failure` (the `decision` taken), `done` (`freed`, `cleaned` keys, `aborted`, `failed`); without `--yes`: `confirmation-required` |
| `tools` | `suggestion`, then `install` (`bin`, `ok`, `error`) per installed tool; without `--yes`: `confirmation-required` |
| `plugins` | `plugin` (name, group, section, projects, items, tools), `config-error` |
| `history` | `operation` (one operations log entry) |

A target in these events has `key`, `plugin`, `item`, `group`, `section`, `label`, `paths`, `listed`, `size`, `linkedBytes`, `ageDays`, `estimated`, `impact` (`kind`, `tag`, `meaning`, `preselected`), `note`, `selected`, `selectedReason`, `commands`, `tool` (`bin`, `installed`, `broken`, `install`, `uninstall`, `clean`), `hooks`, `project`, `fallback`, `sharedWith` (keys) and `coveredBy` (key).

Sizes come from one walk per folder that counts each hard-linked file once and records how much of it is hard-linked elsewhere (`linkedBytes`); deleting one link of a file frees nothing while another link remains, so `plan` reports both the bytes on disk and what would actually be freed. Ages come from the newest file at any depth. Sizes and ages from the last scan are kept in `~/.config/putzteufel/sizes.json` and shown (marked `≈` in the TUI, `estimated` in JSON) while the new scan measures.

## Use at your own risk

putzteufel deletes files. It is free software under the GNU General Public License v3.0 or later (see `LICENSE`), provided **without any warranty**: see sections 15 (Disclaimer of Warranty) and 16 (Limitation of Liability). You choose what is removed, and the review screen lists every folder and command before anything runs. Use Trash mode (`t`) when you are unsure, and keep backups of anything you cannot recreate.

Every cleaned, failed or skipped item is appended to an operations log, `~/Library/Logs/putzteufel/operations.log` on macOS (`$XDG_STATE_HOME/putzteufel/operations.log` elsewhere; `PUTZTEUFEL_LOG` overrides the path), as one JSON object per line with the time, plugin, paths, how each path was removed (`delete` or `trash`), the commands that ran and the size.

## Safety rules

- Symlinks are never followed or deleted through.
- Inside a git repo, a folder without a leading dot (`build`, `dist`, `bin`, `vendor`, `Library`, …) is only offered if git ignores it, so a committed `build/` is never touched. `node_modules`, `__pycache__` and `__pypackages__` skip that check.
- `~/Library`, `~/.Trash`, `/System`, `/Library`, `/Applications` are never walked by the project scan.
- The home directory, its parents and top-level system folders are refused at delete time, whatever a config says.
- In delete mode the review screen says how many folders will be deleted permanently and cannot be recovered; when the Trash is not available (no `trash` or `osascript` command) it says so instead. Folders tagged `data loss` go to the Trash even in delete mode, except things already in the Trash. Commands such as `docker volume prune` cannot use the Trash, and the review screen says that too.
- A folder several plugins reach (say `~/.cache/uv`, found by uv and by the `~/.cache/*` catch-all) is listed under each of them, tagged `also: …`, and counted once: under the folder that contains it, or for the same folder under the specific plugin rather than the catch-all. When both are selected, only that one cleans it; the other is skipped. The file browser shows which other plugins touch each entry.

## Plugins

Every built-in plugin is one file in `src/plugins/`, named after the tool or ecosystem it handles (`node.ts`, `uv.ts`, `docker.ts`, `cargo.ts`, …), and listed in `src/plugins/index.ts`. A plugin belongs to one ecosystem group (JavaScript, Python, Rust, Apple, Containers, macOS, Editors, …) and each group to a section (Languages, Platforms, Apps), which is how the list is ordered and divided. A plugin can have:

- `projects`: rules for folders inside your projects, such as `node_modules` or `target/`, found by the project scan;
- `items`: things in fixed or tool-reported places, such as `~/.cache/uv` or Docker's images.

```js
import { GROUPS } from '../core/index.ts';
import { brew, definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Cargo',
  group: GROUPS.rust,
  projects: [{ name: 'target', markers: ['Cargo.toml'], dirs: ['target'], clean: 'cargo clean', requires: ['cargo'] }],
  items: [{ name: 'Registry', tool: brew('cargo-cache'), paths: ['~/.cargo/registry/cache', '~/.cargo/registry/src'], clean: 'cargo cache --autoclean' }],
});
```

Adding a built-in plugin is one new file plus one line in `src/plugins/index.ts`.

## Configuration

putzteufel reads `~/.config/putzteufel/config.mjs`, then `./putzteufel.config.mjs`, then any `--config FILE`. Later files win; a plugin with the same `name` as a built-in replaces the whole built-in plugin. `settings.disable` takes plugin names (`'Trash'`) or one part of a plugin (`'Docker/Unused volumes'`).

```js
export default {
  settings: {
    roots: ['~/Code'],
    exclude: ['*/keep-this-project/*'],
    olderThan: 0,
    recentDays: 7,
    disable: ['Trash', 'Installers', 'Docker/Unused volumes'],
    hooks: { before: 'osascript -e \'quit app "Xcode"\'', after: 'say done' },
  },

  plugins: [
    {
      name: 'Bazel',
      group: 'Custom',
      projects: [{ name: 'bazel-out', markers: ['MODULE.bazel'], dirs: ['bazel-out'] }],
      items: [
        {
          name: 'Disk cache',
          tool: { bin: 'bazel', install: 'brew install bazelisk', uninstall: 'brew uninstall bazelisk' },
          paths: ['~/.cache/bazel'],
          list: 'bazel info output_base',
          clean: 'bazel clean --expunge',
          hooks: { before: 'bazel shutdown' },
        },
      ],
    },

    { name: 'Spotify cache', group: 'Custom', paths: ['~/Library/Caches/com.spotify.client'] },

    { name: 'Old DMGs', list: 'find ~/Downloads -name "*.dmg" -mtime +30', impact: 'redownload' },

    { name: 'Colima', group: 'Containers', requires: ['colima'], list: 'colima list', clean: 'colima prune -f' },

    { name: 'Big logs', scan: async (ctx) => [{ label: 'Big logs', paths: ['/tmp/huge.log'], listed: ['found by my own code'] }] },
  ],

  projects: [{ name: 'Gleam', group: 'Custom', markers: ['gleam.toml'], dirs: ['build'] }],
};
```

A plugin entry with `items` or `projects` is a full plugin. An entry with `paths`, `list` or `scan` directly is a plugin with that one item. A top-level `projects` entry is a plugin with that one rule. `group` defaults to `Custom`; using a built-in group name (`'Python'`, `'Containers'`) puts your plugin next to the built-ins.

Every item must say what it affects before anything runs, so the TUI can list it:

| key | meaning |
|---|---|
| `paths` | glob patterns (`*`, `?`, `~`). Each match becomes its own entry and is deleted, unless `clean` is set |
| `list` | shell command. Output lines that are existing absolute paths are sized and previewed, other lines are shown as-is, absolute paths that do not exist are dropped. Without `clean`, the listed paths are deleted |
| `clean` | shell command that does the cleanup instead of deleting. Requires `paths`, `list` or `scan` |
| `sizePaths` | extra globs used only for the size column |
| `requires` | binaries needed to find anything at all (`docker`, `xcrun`); the item is hidden without them |
| `tool` | `{ bin, install?, uninstall? }`: the native cleaner. When `bin` is on `PATH`, `list` and `clean` are used; when it is missing, `paths` are the default locations and are deleted directly, unless you let putzteufel run `install` first. `uninstall` runs after the cleanup if you tick that box |
| `hooks` | `{ before?, after? }` shell commands run once around this plugin's entries (also on project rules, and run-wide in `settings.hooks`) |
| `impact` | `"regenerates"` (default for items), `"rebuild"` (default for project rules), `"redownload"`, `"unknown"` or `"dataloss"`; see the table above |
| `description` | one line shown in the preview after the impact explanation, saying what this item's loss means |
| `fallback` | marks a catch-all such as `~/.cache/*`: folders it shares with a specific plugin are counted and cleaned under that plugin |
| `scan` | function `(ctx) => targets[]` for anything the keys above cannot express. Each target needs `label` and at least one of `paths` / `listed`; optional `commands: [{ run, cwd }]` |

Project rules: `markers` (file names or globs in the same folder, or relative paths like `ProjectSettings/ProjectVersion.txt`; empty means anywhere), `dirs` (folder names, globs, or nested paths like `android/build`), or `contains` (any child folder containing these files, used for venvs via `pyvenv.cfg`), plus optional `clean`/`requires`/`impact`/`description`/`hooks`. A rule's `clean` runs in the project folder when its tool is installed. Otherwise the folders are deleted. Two rules may match the same folder (a `build/` with both `CMakeLists.txt` and `build.gradle`); it is then listed under both plugins and counted once.

Unknown keys, wrong types, a `clean` without anything listing what it affects, the old `category` key (now `group`): each is reported with the plugin name and file, shown in the TUI and by `putzteufel --plugins` (exit code 1).

## Built-in plugins

- Languages
  - JavaScript: Node (`node_modules`, `.next`, `.nuxt`, `.svelte-kit`, `.turbo`, `.parcel-cache`, `.angular`, `.expo`, … and build output), React Native, npm, pnpm, yarn, bun, deno, corepack, node-gyp, Electron, TypeScript, Playwright (`playwright uninstall --all` when that CLI is on PATH), Puppeteer, Cypress (`cypress cache clear` when on PATH)
  - Python: Python (caches, virtual environments, build output), uv, pip, poetry, conda, Pixi, pre-commit, Hugging Face (each repo removed with `hf cache rm` when the hf CLI is installed, offered with `brew install hf`), PyTorch
  - Rust: Cargo (`cargo clean`, registry via `cargo cache --autoclean`). Go: build and module caches. Java: Maven, Gradle, SBT. .NET (bin/obj, NuGet). Ruby: Bundler, RubyGems. PHP: Composer. Haskell: Stack, Cabal. Elixir. Dart: Flutter. Zig. C/C++: CMake
- Platforms
  - Apple: Xcode (DerivedData, Previews, Archives, device support, simulator caches, unavailable simulators), Swift, CocoaPods, Carthage
  - Containers: Docker (build cache, and every stopped container, dangling or unused image, unused volume and unused network as its own item with size and age, removed with `docker rm`, `rmi`, `volume rm`, `network rm` and `builder prune`), Podman
  - Terraform. macOS: Homebrew, mise, `~/.cache/*`, `~/Library/Caches/*`, `~/Library/Logs/*`, installers in Downloads, Trash
- Apps
  - Editors: VS Code, Insiders, Cursor, Windsurf, VSCodium; JetBrains. Game engines: Unity, Unreal, Godot

Homebrew can install these for their own cleanup when missing: uv, pnpm, yarn, poetry, deno, Composer, CocoaPods, mise, pre-commit, go, cargo-cache. pip, npm, conda and NuGet are used when present and otherwise deleted directly.

## Prior art this borrows from

- [kondo](https://github.com/tbillington/kondo): the project-type table (markers and artifact folders).
- [npkill](https://flaviocopes.com/npkill.md): size and last-modified columns, pick-then-delete flow.
- [Mole](https://recca0120.github.io/en/2026/03/09/mole-macos-cleaner/): recent projects unselected by default, dry-run listing of every path.
- [mac-cleanup-py](https://pypi.org/project/mac-cleanup): the macOS module list (Xcode, Homebrew, Docker, Gradle).
- [cleanpy](https://pypi.org/project/cleanpy): the Python cache folder list.
- BleachBit's CleanerML: declarative cleaner definitions, the model for the plugin format.
- [DaisyDisk](https://daisydiskapp.com/guide/2/en/UnderstandingSunburst/): the sunburst map, center click to go up, small items merged away.
- [diskonaut](https://www.linuxlinks.com/diskonaut-tui-disk-space-navigator/) and [diskbloom](https://terminaltrove.com/diskbloom/): treemaps in the terminal, map next to a navigable list.
- [superfile](https://github.com/yorukot/superfile): focus shown by frame color, titles in frame borders, sort picker, cursor memory per folder, process panel, skip/abort on failure, too-small screen, first-run screen.
- [tuios](https://github.com/Gaurav-Gosain/tuios): mode pill, footer hints that shorten by priority, help built from the key registry, message bar and log, designed empty states, a 500 ms delay before the preview and file browser show a loading line, dimmed backdrop behind dialogs, live theme preview.

## Code layout

The code is split into layers; each may only use the layers listed before it, which `tests/architecture.test.ts` checks:

```
src/domain/            the rules, no I/O: Target and plugin types, impact tags, ecosystems and sections,
                       stable keys, shared-folder overlap, selection, sorting, fuzzy matching,
                       how each path is disposed of, the cleanup plan and its steps
src/plugins/           api.ts (definePlugin, brew, the plugin format) and one file per built-in plugin
src/infrastructure/    talking to the machine: fs, shell, measure.ts (deep walk, hard links, exact freed),
                       remove.ts (delete and Trash), oplog.ts, config/ (load, validate), store/ (state, size estimates),
                       plugins/ (turning plugin definitions into scanners: items, projects, build)
src/application/       use cases: session (config, plugins, scan context), scan, scan-session (with estimates),
                       clean (hooks, installs, items, failures, uninstalls, operations log)
src/interfaces/cli/    main.ts (commands), args.ts (flags and selectors), output.ts (text or NDJSON),
                       serialize.ts (the JSON schema), commands/ (scan, files, plan, clean, plugins, history), tui.tsx
src/interfaces/tui/    App.tsx (state and layout), input/dispatch.ts (what each key does in each mode),
                       keys.ts (every key binding), state/ (scan, browse, preview, exact size, cleanup run),
                       model/, map/, components/, views/
```

A new built-in cleaner is a new file in `src/plugins/` plus a line in `src/plugins/index.ts`. A new key goes into `src/interfaces/tui/keys.ts` and then into `src/interfaces/tui/input/dispatch.ts`. A new command goes into `src/interfaces/cli/commands/` and `main.ts`, using the same application and domain functions the TUI uses.

## Development

```sh
bun run test               # unit tests + headless TUI tests through @opentui/react/test-utils
bun run typecheck
```

Sources live in `src/` as TypeScript and run directly under Bun; there is no build step.
