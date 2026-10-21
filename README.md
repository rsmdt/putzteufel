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

The screen has the item list on the left, a disk map on the right and a preview of the item under the cursor below the list.

Keys: `↑↓`/`jk` move, `space` toggle (a group toggles all its items), `→`/`←` expand/collapse, `enter`/`f` browse an item's files, `[`/`]` lower/raise the age threshold, `m` switch the map between sunburst, treemap and hidden, `a` toggle all visible, `/` filter, `t` delete vs. Trash mode, `d` review and clean, `r` rescan, `q` quit. Clicking the map moves the cursor to what you clicked; clicking the sunburst's center goes up a level.

The disk map follows DaisyDisk: the sunburst shows categories, tools and items as rings around the center, with arc length proportional to size; the treemap shows the cursor's level as nested rectangles. Selected items are drawn in full color, unselected ones dimmed, so the map shows what will be freed. The map needs a terminal at least 90 columns wide.

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

## Safety rules

- Symlinks are never followed or deleted through.
- Inside a git repo, a folder without a leading dot (`build`, `dist`, `bin`, `vendor`, `Library`, …) is only offered if git ignores it, so a committed `build/` is never touched. `node_modules`, `__pycache__` and `__pypackages__` skip that check.
- `~/Library`, `~/.Trash`, `/System`, `/Library`, `/Applications` are never walked by the project scan.
- The home directory, its parents and top-level system folders are refused at delete time, whatever a config says.
- A specific plugin always wins over a generic one: `~/.cache/*`, `~/Library/Caches/*`, `~/Library/Logs/*` are `fallback` plugins and skip anything an earlier plugin already claimed.

## Configuration and plugins

putzteufel reads `~/.config/putzteufel/config.mjs`, then `./putzteufel.config.mjs`, then any `--config FILE`. Later files win; a plugin or project rule with the same `name` as a built-in replaces it.

```js
export default {
  settings: {
    roots: ['~/Code'],
    exclude: ['*/keep-this-project/*'],
    olderThan: 0,
    recentDays: 7,
    disable: ['Trash', 'Installers in Downloads'],
    hooks: { before: 'osascript -e \'quit app "Xcode"\'', after: 'say done' },
  },

  projects: [
    { name: 'Bazel', markers: ['MODULE.bazel'], dirs: ['bazel-out'] },
    { name: 'Cargo', markers: ['Cargo.toml'], dirs: ['target'], clean: 'cargo clean', requires: ['cargo'] },
  ],

  plugins: [
    { name: 'Spotify cache', category: 'Apps', paths: ['~/Library/Caches/com.spotify.client'] },

    {
      name: 'Old DMGs',
      category: 'Apps',
      list: 'find ~/Downloads -name "*.dmg" -mtime +30',
      impact: 'redownload',
    },

    {
      name: 'Colima',
      category: 'Containers',
      requires: ['colima'],
      list: 'colima list',
      clean: 'colima prune -f',
    },

    {
      name: 'Bazel disk cache',
      category: 'Toolchains',
      tool: { bin: 'bazel', install: 'brew install bazelisk', uninstall: 'brew uninstall bazelisk' },
      paths: ['~/.cache/bazel'],
      list: 'bazel info output_base',
      clean: 'bazel clean --expunge',
      hooks: { before: 'bazel shutdown' },
    },

    {
      name: 'Big logs',
      scan: async (ctx) => [{ label: 'Big logs', paths: ['/tmp/huge.log'], listed: ['found by my own code'] }],
    },
  ],
};
```

Every plugin must say what it affects before anything runs, so the TUI can list it:

| key | meaning |
|---|---|
| `paths` | glob patterns (`*`, `?`, `~`). Each match becomes its own item and is deleted, unless `clean` is set |
| `list` | shell command. Output lines that are existing absolute paths are sized and previewed, other lines are shown as-is, absolute paths that do not exist are dropped. Without `clean`, the listed paths are deleted |
| `clean` | shell command that does the cleanup instead of deleting. Requires `paths`, `list` or `scan` |
| `sizePaths` | extra globs used only for the size column |
| `requires` | binaries needed to find anything at all (`docker`, `xcrun`); the plugin is hidden without them |
| `tool` | `{ bin, install?, uninstall? }`: the native cleaner. When `bin` is on `PATH`, `list` and `clean` are used; when it is missing, `paths` are the default locations and are deleted directly, unless you let putzteufel run `install` first. `uninstall` runs after the cleanup if you tick that box |
| `hooks` | `{ before?, after? }` shell commands run once around this plugin's items (also on project rules, and run-wide in `settings.hooks`) |
| `impact` | `"regenerates"` (default for plugins), `"rebuild"` (default for project rules), `"redownload"`, `"unknown"` or `"dataloss"`; see the table above |
| `description` | one line shown in the preview after the impact explanation, saying what this item's loss means |
| `fallback` | runs after all other plugins and skips paths they claimed |
| `scan` | function `(ctx) => targets[]` for anything the keys above cannot express. Each target needs `label` and at least one of `paths` / `listed`; optional `commands: [{ run, cwd }]` |

Project rules: `markers` (file names or globs in the same folder, or relative paths like `ProjectSettings/ProjectVersion.txt`; empty means anywhere), `dirs` (folder names, globs, or nested paths like `android/build`), or `contains` (any child folder containing these files, used for venvs via `pyvenv.cfg`), plus optional `clean`/`requires`/`impact`/`description`/`hooks`. A rule's `clean` runs in the project folder when its tool is installed. Otherwise the folders are deleted.

Unknown keys, wrong types, a `clean` without anything listing what it affects: each is reported with the plugin name and file, shown in the TUI and by `putzteufel --plugins` (exit code 1).

## Built-in coverage

- Projects (rules borrowed from kondo, plus extras): Node (`node_modules`, `.next`, `.nuxt`, `.svelte-kit`, `.turbo`, `.parcel-cache`, `.angular`, `.expo`, …), React Native, Python caches and venvs, Pixi, Cargo (`cargo clean`), Maven, Gradle, SBT, CMake, Stack (`stack clean --full`), Cabal (`cabal clean`), Swift (`swift package reset`), Flutter (`flutter clean`), Elixir, Composer, Bundler, Zig, .NET, Unity, Unreal, Godot, Terraform, CocoaPods.
- Package managers: uv, pip, npm, pnpm, yarn, bun, poetry, conda, deno, Composer, CocoaPods, RubyGems, NuGet, Homebrew, mise, pre-commit, corepack.
- Toolchains: Go build and module caches, Cargo registry (`cargo cache --autoclean`, offers `brew install cargo-cache`), Gradle, Maven, node-gyp, Electron, TypeScript.
- Tools Homebrew can install for their own cleanup: uv, pnpm, yarn, poetry, deno, Composer, CocoaPods, mise, pre-commit, go, cargo-cache. pip, npm, conda and NuGet are used when present and otherwise deleted directly.
- Browsers, models and test runners: Hugging Face models, PyTorch hub, Playwright, Puppeteer, Cypress.
- Containers: Docker build cache, stopped containers, dangling images, unused images, unused volumes, unused networks (each listed with `docker` itself, cleaned with the matching `docker … prune`), Podman.
- Xcode and Apple: DerivedData, Previews, Archives, device support files, simulator caches, unavailable simulators, SwiftPM, Carthage.
- Editors: VS Code, Insiders, Cursor, Windsurf, VSCodium caches; JetBrains caches and logs.
- System: `~/.cache/*`, `~/Library/Logs/*`, `~/Library/Caches/*`, installers in `~/Downloads`, Trash.

## Prior art this borrows from

- [kondo](https://github.com/tbillington/kondo): the project-type table (markers and artifact folders).
- [npkill](https://flaviocopes.com/npkill.md): size and last-modified columns, pick-then-delete flow.
- [Mole](https://recca0120.github.io/en/2026/03/09/mole-macos-cleaner/): recent projects unselected by default, dry-run listing of every path.
- [mac-cleanup-py](https://pypi.org/project/mac-cleanup): the macOS module list (Xcode, Homebrew, Docker, Gradle).
- [cleanpy](https://pypi.org/project/cleanpy): the Python cache folder list.
- BleachBit's CleanerML: declarative cleaner definitions, the model for the plugin format.
- [DaisyDisk](https://daisydiskapp.com/guide/2/en/UnderstandingSunburst/): the sunburst map, center click to go up, small items merged away.
- [diskonaut](https://www.linuxlinks.com/diskonaut-tui-disk-space-navigator/) and [diskbloom](https://terminaltrove.com/diskbloom/): treemaps in the terminal, map next to a navigable list.

## Development

```sh
bun test --timeout 30000   # unit tests + headless TUI tests through @opentui/react/test-utils
bun run typecheck
```

Sources live in `src/` as TypeScript and run directly under Bun; there is no build step. `src/diskmap.ts` holds the sunburst and treemap layout as plain functions over a size tree.
