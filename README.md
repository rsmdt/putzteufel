# putzteufel

Fullscreen terminal UI that finds regenerable developer clutter (project dependency and build folders, package-manager caches, Docker leftovers, Xcode data, editor caches) and removes it. Where a tool has its own cleanup command (`uv cache clean`, `npm cache clean --force`, `cargo clean`, `docker image prune`, `brew cleanup`, `xcrun simctl delete unavailable`, …) putzteufel runs that command instead of deleting files itself.

Requires [Bun](https://bun.sh) 1.3.14 or newer. The TUI is built on [OpenTUI](https://github.com/anomalyco/opentui) with its React renderer.

```sh
bun install
bun link                       # puts `putzteufel` on PATH
putzteufel                     # TUI: scan cwd for projects + all caches
putzteufel ~/Code --older-than 90
putzteufel --list              # plain dry run, no TUI
putzteufel --plugins           # which plugins are active, config errors
```

Layout: the header starts with a spinner that turns while putzteufel scans or cleans (a check when it is done) and a mode pill (LIST, FILES, MAP, PREVIEW, FILTER, REVIEW, CLEANING, …) that says what your keys act on. Below it are the item list (or the file browser), the preview of the item at the cursor, and the disk map on the right. Each pane has a frame whose titles show the cursor position, the sort and the selection; the focused pane's frame is drawn in the pill's color. The line above the footer shows the latest message (warnings, results, mode changes); `w` opens all of them. The footer lists the keys for the current mode and drops the least important ones first when the window is narrow. Dialogs open over a dimmed screen.

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
| `t` | delete vs. Trash mode |
| `d` | review and clean |
| `w` | message log |
| `T` | theme (dark, light, high contrast; previews live, saved on enter) |
| `r`, `q` | rescan, quit |

While cleaning, a progress panel shows every step (hooks, installs, items, uninstalls) with its state and an overall bar. When an item fails you choose: `r` retry, `s` skip, `S` skip all further failures, `a` abort the remaining items (uninstalls and the run's after hook still run).

The disk map follows DaisyDisk: the sunburst shows ecosystems, plugins and items as rings around the center, with arc length proportional to size; the treemap shows the cursor's level as nested rectangles. Selected items are drawn in full color, unselected ones dimmed, so the map shows what will be freed. The map needs a terminal at least 90 columns wide; the header says so when it is hidden. Below 60×16 putzteufel shows the size it needs. `--ascii` (or `settings.icons: 'ascii'`) avoids Unicode block characters; `settings.icons: 'nerd'` adds Nerd Font category icons. The first run shows a short welcome; that and the chosen theme are remembered in `~/.config/putzteufel/state.json`.

Nothing is removed until you press `d`, read the confirmation screen listing every path, command and listed item, and press `y`. Before that, `enter` or `f` on an item opens a file browser with the size of every folder and file inside it; folders open with `enter`, `←` goes back up. An item is always removed as a unit.

Native tools: built-in plugins find their folders even when the tool that owns them is missing (they know each tool's default locations, and ask the tool itself when it is installed). The preview says which command will clean the item, or that the tool is missing and the folders will be deleted directly. When you press `d` and selected items have a missing tool that Homebrew can install, a screen lists those tools, all checked: checked tools are installed with `brew install` and do the cleanup with their own command, unchecked ones fall back to direct deletion. A checkbox at the bottom uninstalls the tools again after the cleanup (`brew uninstall` of that formula only; dependencies brew pulled in stay). The review screen lists every install, uninstall and hook command before you press `y`. If an install fails, that tool's items are skipped, not deleted.

Run order: `settings.hooks.before` (if it fails, nothing runs), installs, then per plugin its `hooks.before`, its items, its `hooks.after`, then uninstalls, then `settings.hooks.after`.

Age threshold: `[`/`]` step through any age, 1, 3, 7, 14, 30, 60, 90, 180 and 365 days, and reselect every item whose age is known: it is selected when it is older than the threshold, and deselected otherwise. `--older-than` or `settings.olderThan` sets the starting value. Projects are aged by their newest source file, other folders by the newest entry directly inside them. Items with nothing on disk to date (Docker objects, unavailable simulators) have no age and keep their selection.

Every item carries an impact tag that says what happens after it is removed. The preview under the list explains the tag and the item's own note, and says why the item is or is not selected; `?` shows the legend; the review screen totals the selection per tag.

| tag | meaning | selected by default |
|---|---|---|
| `regenerates` | the tool recreates it on its own when needed (`__pycache__`, package-manager caches) | yes |
| `rebuild` | the next install or build recreates it (`node_modules`, `target/`, DerivedData) | yes |
| `re-download` | fetched again from the network on next use (Hugging Face models, Playwright browsers, Go modules) | no |
| `unknown` | putzteufel cannot tell whether anything recreates it (`~/.cache/*`, `~/Library/Caches/*`, `dist/`) | no |
| `data loss` | cannot be recovered (Docker volumes and stopped containers, Xcode archives, Trash) | no |

Items younger than the age threshold and projects edited within `recentDays` (default 7) also start unselected, tagged `recent`.

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
  - JavaScript: Node (`node_modules`, `.next`, `.nuxt`, `.svelte-kit`, `.turbo`, `.parcel-cache`, `.angular`, `.expo`, … and build output), React Native, npm, pnpm, yarn, bun, deno, corepack, node-gyp, Electron, TypeScript, Playwright, Puppeteer, Cypress
  - Python: Python (caches, virtual environments, build output), uv, pip, poetry, conda, Pixi, pre-commit, Hugging Face, PyTorch
  - Rust: Cargo (`cargo clean`, registry via `cargo cache --autoclean`). Go: build and module caches. Java: Maven, Gradle, SBT. .NET (bin/obj, NuGet). Ruby: Bundler, RubyGems. PHP: Composer. Haskell: Stack, Cabal. Elixir. Dart: Flutter. Zig. C/C++: CMake
- Platforms
  - Apple: Xcode (DerivedData, Previews, Archives, device support, simulator caches, unavailable simulators), Swift, CocoaPods, Carthage
  - Containers: Docker (build cache, stopped containers, dangling and unused images, unused volumes and networks, each listed with `docker` and pruned with it), Podman
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

```
bin/putzteufel.ts            entry point (Bun)
src/cli.tsx                argument parsing, --list / --plugins, starts the TUI
src/core/                  shared building blocks, no UI
  types.ts  groups.ts      Target, Plugin, Tool, Hooks, Entry, ScanContext; ecosystems and sections
  impact.ts                impact tags and default selection
  paths.ts  shell.ts       path helpers and safety checks; shell, PATH lookup
  disk.ts  clean.ts        sizes, ages, listings; deleting and running clean commands
src/plugins/               one file per built-in plugin (node.ts, uv.ts, docker.ts, …), index.ts lists them
src/config/                load.ts (config files), validate.ts (error messages), state.ts (welcome, theme)
src/engine/                the plugin runtime
  define.ts                plugin format: definePlugin, items, project rules, brew()
  build.ts                 turns plugin definitions into scanners
  items.ts  projects.ts    item scanning; the project folder walk
  overlap.ts               folders shared by plugins: owners, counted-once sizes
  scan.ts  run.ts          running a scan; running a cleanup (hooks, installs, failures, progress)
src/tui/                   the terminal UI
  App.tsx                  state, focus and key dispatch
  keys.ts                  every key binding; feeds dispatch, footer and help
  hints.ts  fuzzy.ts  sort.ts  theme.ts  look.ts  hooks.ts
  model/                   rows, file browser stack, explanations, messages
  map/layout.ts            sunburst and treemap geometry
  state/                   useScan, useCleanRun
  components/              Frame, Overlay, header/footer/message bar, empty state, tags
  views/                   ListPane, FilesPane, PreviewPane, MapPane, dialogs/*
```

A new built-in cleaner is a new file in `src/plugins/`; a new key goes into `src/tui/keys.ts` and then into the `dispatch` switch in `App.tsx`.

## Development

```sh
bun run test               # unit tests + headless TUI tests through @opentui/react/test-utils
bun run typecheck
```

Sources live in `src/` as TypeScript and run directly under Bun; there is no build step.
