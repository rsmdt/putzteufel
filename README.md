<p align="center">
  <b>putzteufel</b>
</p>

<p align="center">
  Clean up after your tools. Free the space they leave behind with <b>putzteufel</b>.
</p>

---

## Table of Contents

- [🧹 What is putzteufel?](#-what-is-putzteufel)
- [🚀 Quick Start](#-quick-start)
- [📖 How It Works](#-how-it-works)
- [🧰 Supported Tools](#-supported-tools)
- [⌨️ Command Line](#️-command-line)
- [🔧 Configuration](#-configuration)
- [🛡️ Safety](#️-safety)
- [🧑‍💻 Development](#-development)

---

## 🧹 What is putzteufel?

> **Putzteufel** /ˈpʊtsˌtɔɪfəl/ (*POOTS-toy-fel*): German for "cleaning devil", someone who can't stop tidying up.

putzteufel is a meta cleanup tool. Instead of you remembering how each tool prunes its own leftovers, it finds them and asks that tool to do the cleanup. Where a tool has no cleanup of its own, putzteufel removes the folders itself.

Docker, for example: putzteufel finds stopped containers, unused images and volumes, and stale build cache, and has Docker remove them with its own commands. Xcode's DerivedData has no such command, so putzteufel deletes it itself. [Supported Tools](#-supported-tools) lists which cleanup each tool gets.

### Installation

**Requirements:** Node.js 26.4 or newer

```sh
npx putzteufel
npm install -g putzteufel   # or keep it on PATH
```

---

## 🚀 Quick Start

```sh
putzteufel                          # scan the current folder and all caches
putzteufel ~/Code --older-than 90   # only select what is untouched for 90 days
```

Move with `↑↓`, select with `space`, press `d` to review and `y` to clean. `?` shows every key.

---

## 📖 How It Works

```
┌──────────────────────────────────────────────────────────┐
│  SCAN                                                    │
│  Plugins find projects, caches and tool leftovers,       │
│  measure them, and tag each with its impact.             │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  SELECT                                                  │
│  Safe items start selected. Browse files, filter,        │
│  and raise or lower the age threshold with [ and ].      │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  REVIEW                                                  │
│  Every path, command, tool install and hook is listed.   │
│  Nothing runs until you press y.                         │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  CLEAN                                                   │
│  Native commands run, folders are deleted or trashed,    │
│  and every step is written to the operations log.        │
└──────────────────────────────────────────────────────────┘
```

---

## 🧰 Supported Tools

### Built-in

These have no cleanup command of their own, so putzteufel deletes the folders itself.

| Name | Group | Description |
|---|---|---|
| `bun` | JavaScript | global package cache |
| `corepack` | JavaScript | downloaded package manager versions |
| `electron` | JavaScript | downloaded Electron binaries |
| `node` | JavaScript | `node_modules`, framework caches and build output in projects |
| `node-gyp` | JavaScript | downloaded Node headers |
| `puppeteer` | JavaScript | downloaded browsers |
| `react-native` | JavaScript | native Android and iOS builds in projects |
| `tsc` | JavaScript | TypeScript build info cache |
| `python` | Python | `__pycache__`, virtual environments and build output in projects |
| `pixi` | Python | project environments |
| `torch` | Python | PyTorch Hub downloads |
| `mvn` | Java | local repository and `target` folders |
| `gradle` | Java | caches, wrapper distributions and build folders |
| `sbt` | Java | `target` folders |
| `bundle` | Ruby | `vendor/bundle` in projects |
| `cabal` | Haskell | `dist-newstyle` folders |
| `stack` | Haskell | `.stack-work` folders |
| `mix` | Elixir | `_build` and `deps` folders |
| `flutter` | Dart | build folders |
| `zig` | Zig | cache and build output |
| `cmake` | C/C++ | build folders |
| `swift` | Apple | SwiftPM cache and `.build` folders |
| `carthage` | Apple | dependency cache |
| `xcodebuild` | Apple | DerivedData, previews, archives, device support and simulator caches |
| `terraform` | Terraform | `.terraform` folders |
| `code` | Editors | caches of VS Code, Insiders, Cursor, Windsurf and VSCodium |
| `idea` | Editors | caches and logs of JetBrains IDEs |
| `unity` | Game engines | `Library`, `Temp` and build folders in projects |
| `unreal` | Game engines | intermediate files, saved data and builds in projects |
| `godot` | Game engines | `.godot` folders |
| `~/.cache` | macOS | caches of command-line tools |
| `~/Library/Caches` | macOS | app caches |
| `~/Library/Logs` | macOS | app logs |
| `~/Downloads` | macOS | disk images and installer packages |
| `~/.Trash` | macOS | the Trash |

### Vendored

These are cleaned with the tool's own command. When the tool is missing, putzteufel deletes the folders directly, or installs it with Homebrew first if you allow it (marked ¹). `docker`, `podman`, `brew`, `gem` and `xcrun` only show up when installed.

| Name | Group | Description |
|---|---|---|
| `npm` | JavaScript | package cache |
| `pnpm`¹ | JavaScript | content-addressable store |
| `yarn`¹ | JavaScript | package cache |
| `deno`¹ | JavaScript | module cache |
| `playwright` | JavaScript | downloaded browsers |
| `cypress` | JavaScript | downloaded binaries |
| `uv`¹ | Python | package cache |
| `pip` | Python | package cache |
| `poetry`¹ | Python | package cache |
| `conda` | Python | downloaded packages |
| `pre-commit`¹ | Python | hook environments |
| `hf`¹ | Python | Hugging Face models and datasets |
| `cargo` | Rust | `target` folders, and the registry with `cargo-cache`¹ |
| `go`¹ | Go | build and module cache |
| `dotnet` | .NET | NuGet packages |
| `gem` | Ruby | old gem versions |
| `composer`¹ | PHP | package cache |
| `pod`¹ | Apple | CocoaPods cache |
| `xcrun` | Apple | unavailable simulators |
| `docker` | Containers | stopped containers, unused images, volumes and networks, build cache |
| `podman` | Containers | unused containers, images and volumes |
| `brew` | macOS | old versions and downloads |
| `mise` | macOS | tool cache |

---

## ⌨️ Command Line

| Command | Purpose |
|---|---|
| `putzteufel scan` | list what can be cleaned, each item with a stable key |
| `putzteufel files KEY` | list the files inside one item |
| `putzteufel plan` | show what a cleanup would do, nothing is removed |
| `putzteufel clean --yes` | clean the selected items |
| `putzteufel tools` | native tools the scan suggests installing |
| `putzteufel plugins` | list plugins, their tools and config errors |
| `putzteufel history` | cleanups recorded in the operations log |

```sh
putzteufel plan --plugin Docker --older-than 30
putzteufel clean --impact regenerates --trash --yes
putzteufel scan --json | jq 'select(.event == "done")'
```

Run `putzteufel --help` for every selector and flag.

---

## 🔧 Configuration

putzteufel reads `~/.config/putzteufel/config.mjs`, then `./putzteufel.config.mjs`, then any `--config FILE`.

```js
export default {
  settings: {
    roots: ['~/Code'],
    disable: ['Trash', 'Docker/Unused volumes'],
  },
  plugins: [
    { name: 'Spotify cache', paths: ['~/Library/Caches/com.spotify.client'] },
    { name: 'Old DMGs', list: 'find ~/Downloads -name "*.dmg" -mtime +30', impact: 'redownload' },
    { name: 'Colima', requires: ['colima'], list: 'colima list', clean: 'colima prune -f' },
  ],
  projects: [{ name: 'Gleam', markers: ['gleam.toml'], dirs: ['build'] }],
};
```

Built-in plugins live in `src/plugins/`, one file per tool. Adding one is a new file plus a line in `src/plugins/index.ts`.

---

## 🛡️ Safety

- Symlinks are never followed or deleted through
- Inside a git repo, a folder like `build/` is only offered if git ignores it
- The home folder, its parents and system folders are refused, whatever a config says
- Items tagged `data loss` go to the Trash even in delete mode
- A folder found by several plugins is counted and cleaned once
- Every cleaned, failed or skipped item is logged to `~/Library/Logs/putzteufel/operations.log` (or `$XDG_STATE_HOME/putzteufel/` elsewhere)

putzteufel deletes files. It is free software under the GNU General Public License v3.0 or later (see `LICENSE`), provided **without any warranty**: see sections 15 and 16. Use Trash mode (`t`) when you are unsure, and keep backups of anything you cannot recreate.

---

## 🧑‍💻 Development

Development needs [Bun](https://bun.sh) 1.3.14 or newer.

```sh
bun install
bun run start
bun run test
bun run typecheck
bun run build   # bundles dist/putzteufel.js for Node, also run by npm publish
```

Sources are TypeScript in `src/` and run directly under Bun. The TUI is built on [OpenTUI](https://github.com/anomalyco/opentui). Ideas borrowed from [kondo](https://github.com/tbillington/kondo), [npkill](https://github.com/voidcosmos/npkill), [DaisyDisk](https://daisydiskapp.com), [superfile](https://github.com/yorukot/superfile) and [tuios](https://github.com/Gaurav-Gosain/tuios).
