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
- [🧰 Supported Tools](#-supported-tools)
- [⌨️ Command Line](#️-command-line)
- [🔧 Configuration](#-configuration)
- [🛡️ Safety](#️-safety)
- [🧑‍💻 Development](#-development)

---

## 🧹 What is putzteufel?

> **Putzteufel** /ˈpʊtsˌtɔɪfəl/ (*POOTS-toy-fel*): German for "cleaning devil", someone who can't stop tidying up.

putzteufel is a meta cleanup tool. It finds what your tools leave behind and has each tool clean up after itself, so `docker` prunes its own images and volumes. Where a tool has no cleanup command, such as Xcode's DerivedData, putzteufel deletes the folders itself. See [Supported Tools](#-supported-tools).

### Installation

**Requirements:** Node.js 26.4 or newer

```sh
npx putzteufel
npm install -g putzteufel
```

---

## 🚀 Quick Start

```sh
putzteufel                     # current folder and all caches
putzteufel --older-than 90     # select only what is older than 90 days
```

`?` shows every key.

---

## 🧰 Supported Tools

### Built-in

putzteufel deletes the folders itself.

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

The tool cleans up with its own command. If it is missing, putzteufel deletes the folders instead, or installs the tool with Homebrew first (¹).

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

Add `--json` for newline-delimited JSON. `putzteufel --help` lists every flag.

---

## 🔧 Configuration

Config is read from `~/.config/putzteufel/config.mjs`, `./putzteufel.config.mjs` and `--config FILE`.

```js
export default {
  settings: { disable: ['Trash'] },
  plugins: [
    { name: 'Colima', requires: ['colima'], list: 'colima list', clean: 'colima prune -f' },
  ],
  projects: [{ name: 'Gleam', markers: ['gleam.toml'], dirs: ['build'] }],
};
```

Built-in plugins are one file per tool in `src/plugins/`.

---

## 🛡️ Safety

- Nothing is removed before you confirm the review
- Symlinks are never followed, and a committed `build/` is never offered
- The home folder and system folders are always refused
- Unrecoverable folders go to the Trash
- Every operation is logged

putzteufel deletes files and comes **without any warranty** (GPL-3.0-or-later, see `LICENSE`).

---

## 🧑‍💻 Development

```sh
npm install
npm start
npm test
npm run typecheck
npm run build
```

Built on [OpenTUI](https://github.com/anomalyco/opentui). Ideas borrowed from [kondo](https://github.com/tbillington/kondo), [npkill](https://github.com/voidcosmos/npkill), [DaisyDisk](https://daisydiskapp.com), [superfile](https://github.com/yorukot/superfile) and [tuios](https://github.com/Gaurav-Gosain/tuios).
