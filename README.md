<p align="center">
  <b>putzteufel</b>
</p>

<p align="center">
  Clean up after your tools. Free the space they leave behind with <b>putzteufel</b>.
</p>

![putzteufel TUI](https://raw.githubusercontent.com/rsmdt/putzteufel/main/docs/tui.png)

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

**Requirements:** Node.js 26.4 or newer. No install needed, run it with `npx`.

---

## 🚀 Quick Start

```sh
npx putzteufel                     # TUI: current folder and all caches
npx putzteufel --older-than 90     # TUI: select only what is older than 90 days
```

`?` shows every key.

---

## 🧰 Supported Tools

### Built-in

putzteufel deletes the folders itself.

| Name | Group | Description |
|---|---|---|
| `putzteufel` | all | dependency and build folders in projects (`node_modules`, virtual environments, `target`, `build`), download caches of tools without a cleanup command, Xcode DerivedData and old device support files, folders tagged with `CACHEDIR.TAG`, old Claude Code versions in Claude Desktop, leftover automation browser profiles, editor caches, `~/.cache`, `~/Library/Caches`, old installers and the Trash |

### Vendored

The tool cleans up with its own command. If it is missing, putzteufel deletes the folders instead, or installs the tool with Homebrew first (¹).

| Name | Group | Description |
|---|---|---|
| [`npm`](https://github.com/npm/cli) | JavaScript | package cache |
| [`pnpm`](https://github.com/pnpm/pnpm)¹ | JavaScript | content-addressable store |
| [`yarn`](https://github.com/yarnpkg/berry)¹ | JavaScript | package cache |
| [`deno`](https://github.com/denoland/deno)¹ | JavaScript | module cache |
| [`playwright`](https://github.com/microsoft/playwright) | JavaScript | downloaded browsers |
| [`cypress`](https://github.com/cypress-io/cypress) | JavaScript | downloaded binaries |
| [`uv`](https://github.com/astral-sh/uv)¹ | Python | package cache |
| [`pip`](https://github.com/pypa/pip) | Python | package cache |
| [`poetry`](https://github.com/python-poetry/poetry)¹ | Python | package cache |
| [`conda`](https://github.com/conda/conda) | Python | downloaded packages |
| [`pre-commit`](https://github.com/pre-commit/pre-commit)¹ | Python | hook environments |
| [`hf`](https://github.com/huggingface/huggingface_hub)¹ | Python | Hugging Face models and datasets |
| [`cargo`](https://github.com/rust-lang/cargo) | Rust | `target` folders, and the registry with [`cargo-cache`](https://github.com/matthiaskrgr/cargo-cache)¹ |
| [`go`](https://github.com/golang/go)¹ | Go | build and module cache |
| [`dotnet`](https://github.com/dotnet/sdk) | .NET | NuGet packages |
| [`gem`](https://github.com/ruby/rubygems) | Ruby | old gem versions |
| [`composer`](https://github.com/composer/composer)¹ | PHP | package cache |
| [`dart`](https://github.com/dart-lang/sdk) | Dart | pub cache |
| [`pod`](https://github.com/CocoaPods/CocoaPods)¹ | Apple | CocoaPods cache |
| `xcrun` | Apple | unavailable simulators, unused simulator runtimes |
| [`docker`](https://github.com/docker/cli) | Containers | stopped containers, unused images, volumes and networks, build cache |
| [`podman`](https://github.com/podman-container-tools/podman) | Containers | unused containers, images and volumes |
| [`brew`](https://github.com/Homebrew/brew) | macOS | old versions and downloads |
| [`mise`](https://github.com/jdx/mise) | macOS | tool cache |
| [`nix-store`](https://github.com/NixOS/nix) | Nix | unreachable store paths |

---

## ⌨️ Command Line

| Command | Purpose |
|---|---|
| `npx putzteufel scan` | list what can be cleaned, each item with a stable key |
| `npx putzteufel files KEY` | list the files inside one item |
| `npx putzteufel plan` | show what a cleanup would do, nothing is removed |
| `npx putzteufel clean --yes` | clean the selected items |
| `npx putzteufel tools` | native tools the scan suggests installing |
| `npx putzteufel plugins` | list plugins, their tools and config errors |
| `npx putzteufel history` | cleanups recorded in the operations log |

Add `--json` for newline-delimited JSON. `npx putzteufel --help` lists every flag.

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
- A folder replaced since the scan is left in place
- Projects with a running process, and `node_modules` changed after the last install, start unselected
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
