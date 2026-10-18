# putzteufel

Fullscreen terminal UI that finds regenerable developer clutter (project dependency and build folders, package-manager caches, Docker leftovers, Xcode data, editor caches) and removes it. Where a tool has its own cleanup command (`uv cache clean`, `npm cache clean --force`, `cargo clean`, `docker image prune`, `brew cleanup`, `xcrun simctl delete unavailable`, …) putzteufel runs that command instead of deleting files itself.

```sh
npm install
npm link                       # puts `putzteufel` on PATH
putzteufel                     # TUI: scan cwd for projects + all caches
putzteufel ~/Code --older-than 90
putzteufel --list              # plain dry run, no TUI
putzteufel --plugins           # which plugins are active, config errors
```

Keys: `↑↓`/`jk` move, `space` toggle (a group toggles all its items), `→`/`←` expand/collapse, `a` toggle all visible, `/` filter, `t` delete vs. Trash mode, `d` review and clean, `r` rescan, `q` quit.

Nothing is removed until you press `d`, read the confirmation screen listing every path and command, and press `y`.

Default selection: items marked `costly` (re-download is expensive or data is lost: Docker volumes and images, Hugging Face models, Playwright browsers, Xcode archives, `~/Library/Caches/*`, Trash, build output folders with ambiguous names) and projects edited within `recentDays` (default 7) start unselected.

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
      safety: 'costly',
    },

    {
      name: 'Colima',
      category: 'Containers',
      requires: ['colima'],
      list: 'colima list',
      clean: 'colima prune -f',
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
| `requires` | binaries that must be on `PATH`, otherwise the plugin is hidden |
| `safety` | `"safe"` (selected by default) or `"costly"` |
| `fallback` | runs after all other plugins and skips paths they claimed |
| `scan` | function `(ctx) => targets[]` for anything the keys above cannot express. Each target needs `label` and at least one of `paths` / `listed`; optional `commands: [{ run, cwd }]` |

Project rules: `markers` (file names or globs in the same folder, or relative paths like `ProjectSettings/ProjectVersion.txt`; empty means anywhere), `dirs` (folder names, globs, or nested paths like `android/build`), or `contains` (any child folder containing these files, used for venvs via `pyvenv.cfg`), plus optional `clean`/`requires`/`safety`. A rule's `clean` runs in the project folder when its tool is installed. Otherwise the folders are deleted.

Unknown keys, wrong types, a `clean` without anything listing what it affects: each is reported with the plugin name and file, shown in the TUI and by `putzteufel --plugins` (exit code 1).

## Built-in coverage

- Projects (rules borrowed from kondo, plus extras): Node (`node_modules`, `.next`, `.nuxt`, `.svelte-kit`, `.turbo`, `.parcel-cache`, `.angular`, `.expo`, …), React Native, Python caches and venvs, Pixi, Cargo (`cargo clean`), Maven, Gradle, SBT, CMake, Stack (`stack clean --full`), Cabal (`cabal clean`), Swift (`swift package reset`), Flutter (`flutter clean`), Elixir, Composer, Bundler, Zig, .NET, Unity, Unreal, Godot, Terraform, CocoaPods.
- Package managers: uv, pip, npm, pnpm, yarn, bun, poetry, conda, deno, Composer, CocoaPods, RubyGems, NuGet, Homebrew, mise, pre-commit, corepack.
- Toolchains: Go build and module caches, Cargo registry (`cargo cache --autoclean` when cargo-cache is installed), Gradle, Maven, node-gyp, Electron, TypeScript.
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

## Development

```sh
npm test          # node:test + ink-testing-library
npm run typecheck
```

Sources live in `src/` as TypeScript and run directly through `tsx`; there is no build step.
