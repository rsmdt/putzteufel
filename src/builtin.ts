import type { PluginSpec } from './plugins.ts';
import type { ProjectRule } from './projects.ts';

export const builtinRules: ProjectRule[] = [
  { name: 'Node', markers: ['package.json'], dirs: ['node_modules', '.angular', '.next', '.nuxt', '.output', '.svelte-kit', '.parcel-cache', '.turbo', '.expo', '.metro', '.docusaurus'], description: 'Reinstalled by npm/pnpm/yarn/bun install; framework caches rebuild on the next dev or build run.' },
  { name: 'Node build output', markers: ['package.json'], dirs: ['dist', 'build', 'out', 'coverage', 'storybook-static'], impact: 'unknown', description: 'Named like build output. Only a build script can tell whether it is recreated; committed folders are already skipped.' },
  { name: 'React Native', markers: ['package.json'], dirs: ['android/build', 'android/.gradle', 'ios/build', 'ios/Pods', 'ios/DerivedData'], description: 'Recreated by the next Gradle, pod install or Xcode build.' },
  { name: 'Python caches', dirs: ['__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.pytype', '.hypothesis', '.tox', '.nox', '__pypackages__', '.ipynb_checkpoints'], impact: 'regenerates', description: 'Bytecode and test/lint caches, rewritten on the next run.' },
  { name: 'Python venv', contains: ['pyvenv.cfg'], description: 'Recreate with uv sync, poetry install or pip install -r requirements.txt. Anything installed by hand is lost.' },
  { name: 'Python build output', markers: ['pyproject.toml', 'setup.py', 'setup.cfg'], dirs: ['build', 'dist', '*.egg-info', '.eggs', 'htmlcov'], impact: 'unknown', description: 'Wheels and build trees. Recreated by a build, but a dist/ you meant to publish is gone.' },
  { name: 'Pixi', markers: ['pixi.toml'], dirs: ['.pixi'], description: 'Recreated by pixi install.' },
  { name: 'Cargo', markers: ['Cargo.toml'], dirs: ['target'], clean: 'cargo clean', requires: ['cargo'], description: 'Recompiled by the next cargo build. Large projects take minutes.' },
  { name: 'Cargo xwin', markers: ['Cargo.toml'], dirs: ['.xwin-cache'], impact: 'redownload', description: 'Windows SDK files, downloaded again by cargo xwin.' },
  { name: 'Maven', markers: ['pom.xml'], dirs: ['target'] },
  { name: 'Gradle', markers: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'], dirs: ['build', '.gradle'] },
  { name: 'SBT', markers: ['build.sbt'], dirs: ['target', 'project/target'] },
  { name: 'CMake', markers: ['CMakeLists.txt'], dirs: ['build', 'cmake-build-*'] },
  { name: 'Stack', markers: ['stack.yaml'], dirs: ['.stack-work'], clean: 'stack clean --full', requires: ['stack'] },
  { name: 'Cabal', markers: ['cabal.project'], dirs: ['dist-newstyle'], clean: 'cabal clean', requires: ['cabal'] },
  { name: 'Swift', markers: ['Package.swift'], dirs: ['.build'], clean: 'swift package reset', requires: ['swift'] },
  { name: 'Flutter', markers: ['pubspec.yaml'], dirs: ['build', '.dart_tool', 'linux/flutter/ephemeral', 'windows/flutter/ephemeral', 'macos/Flutter/ephemeral', 'ios/Flutter/ephemeral'], clean: 'flutter clean', requires: ['flutter'] },
  { name: 'Elixir', markers: ['mix.exs'], dirs: ['_build', 'deps', '.elixir-tools', '.elixir_ls', '.lexical'], description: 'Recreated by mix deps.get and mix compile.' },
  { name: 'Composer', markers: ['composer.json'], dirs: ['vendor'], description: 'Recreated by composer install.' },
  { name: 'Bundler', markers: ['Gemfile'], dirs: ['vendor/bundle'], description: 'Recreated by bundle install.' },
  { name: 'Zig', markers: ['build.zig'], dirs: ['zig-cache', '.zig-cache', 'zig-out'] },
  { name: '.NET', markers: ['*.csproj', '*.fsproj'], dirs: ['bin', 'obj'] },
  { name: 'Unity', markers: ['ProjectSettings/ProjectVersion.txt'], dirs: ['Library', 'Temp', 'Obj', 'Logs', 'MemoryCaptures'], description: 'Unity reimports all assets on next open, which can take a long time.' },
  { name: 'Unity builds', markers: ['ProjectSettings/ProjectVersion.txt'], dirs: ['Build', 'Builds'], impact: 'unknown', description: 'Player builds you made. Keep them if you still need that build.' },
  { name: 'Unreal', markers: ['*.uproject'], dirs: ['Binaries', 'DerivedDataCache', 'Intermediate'] },
  { name: 'Unreal saved and builds', markers: ['*.uproject'], dirs: ['Saved', 'Build'], impact: 'dataloss', description: 'Saved/ holds autosaves, local config and logs. Build/ holds packaged builds.' },
  { name: 'Godot', markers: ['project.godot'], dirs: ['.godot'] },
  { name: 'Terraform', markers: ['.terraform.lock.hcl'], dirs: ['.terraform'], impact: 'redownload', description: 'Providers and modules, fetched again by terraform init.' },
  { name: 'CocoaPods', markers: ['Podfile'], dirs: ['Pods'], description: 'Recreated by pod install.' },
];

const PM = 'Package managers';
const TOOLCHAINS = 'Toolchains';
const BROWSERS = 'Browsers, models & test runners';
const CONTAINERS = 'Containers';
const APPLE = 'Xcode & Apple';
const EDITORS = 'Editors & IDEs';
const SYSTEM = 'System';

const brew = (bin: string, formula = bin) => ({ bin, install: `brew install ${formula}`, uninstall: `brew uninstall ${formula}` });

const docker = (list: string) => `if docker info >/dev/null 2>&1; then ${list}; fi`;

const DOCKER_UNUSED_IMAGES = `{ docker ps -aq | xargs docker inspect --format 'USED {{.Image}}' 2>/dev/null; docker images --no-trunc --format '{{.ID}}  {{.Repository}}:{{.Tag}}  {{.Size}}'; } | awk '$1=="USED"{used[$2]=1; next} !used[$1]'`;

const DOCKER_UNUSED_NETWORKS = `{ docker ps -aq | xargs docker inspect --format '{{range .NetworkSettings.Networks}}USED {{.NetworkID}} {{end}}' 2>/dev/null | tr ' ' '\\n' | paste -d' ' - - ; docker network ls --no-trunc --filter type=custom --format '{{.ID}}  {{.Name}}  {{.Driver}}'; } | awk '$1=="USED"{used[$2]=1; next} NF && !used[$1]'`;

const vscodeFamily = ['Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium'].map(
  (app): PluginSpec => ({
    name: `${app} caches`,
    category: EDITORS,
    paths: ['Cache', 'CachedData', 'CachedExtensionVSIXs', 'Code Cache', 'GPUCache', 'logs'].map((d) => `~/Library/Application Support/${app}/${d}`),
    description: `Caches and logs of ${app}. Quit the editor first.`,
  }),
);

export const builtinPlugins: PluginSpec[] = [
  { name: 'uv', category: PM, tool: brew('uv'), paths: ['~/.cache/uv', '~/Library/Caches/uv'], list: 'uv cache dir', clean: 'uv cache clean' },
  { name: 'pip', category: PM, tool: { bin: 'pip3' }, paths: ['~/Library/Caches/pip', '~/.cache/pip'], list: 'pip3 cache dir', clean: 'pip3 cache purge' },
  { name: 'npm', category: PM, tool: { bin: 'npm' }, paths: ['~/.npm/_cacache'], list: 'echo "$(npm config get cache)/_cacache"', clean: 'npm cache clean --force' },
  { name: 'pnpm', category: PM, tool: brew('pnpm'), paths: ['~/Library/pnpm/store/*', '~/.local/share/pnpm/store/*'], list: 'pnpm store path', clean: 'pnpm store prune', description: 'Removes packages no project references' },
  { name: 'yarn', category: PM, tool: brew('yarn'), paths: ['~/Library/Caches/Yarn', '~/.cache/yarn'], list: 'yarn cache dir', clean: 'yarn cache clean' },
  { name: 'bun', category: PM, paths: ['~/.bun/install/cache', '~/.cache/.bun/install/cache'], description: 'bun pm cache only works inside a project and can point at its node_modules/.cache, so the global cache folder is deleted directly.' },
  { name: 'poetry', category: PM, tool: brew('poetry'), paths: ['~/Library/Caches/pypoetry', '~/.cache/pypoetry'], list: 'd="$(poetry config cache-dir)" && echo "$d/cache" && echo "$d/artifacts"', clean: 'poetry cache list | xargs -n1 poetry cache clear --all -n' },
  { name: 'conda', category: PM, tool: { bin: 'conda' }, paths: ['~/miniconda3/pkgs', '~/miniforge3/pkgs', '~/anaconda3/pkgs', '~/.conda/pkgs'], list: 'echo "$(conda info --base)/pkgs"', clean: 'conda clean --all -y' },
  { name: 'deno', category: PM, tool: brew('deno'), paths: ['~/Library/Caches/deno', '~/.cache/deno'], list: `deno info --json | sed -n 's/.*"denoDir": *"\\([^"]*\\)".*/\\1/p'`, clean: 'deno clean' },
  { name: 'Composer', category: PM, tool: brew('composer'), paths: ['~/Library/Caches/composer', '~/.composer/cache', '~/.cache/composer'], list: 'composer config --global cache-dir', clean: 'composer clear-cache' },
  { name: 'CocoaPods', category: PM, tool: brew('pod', 'cocoapods'), paths: ['~/Library/Caches/CocoaPods'], clean: 'pod cache clean --all' },
  { name: 'RubyGems old versions', category: PM, requires: ['gem'], list: 'gem cleanup --dryrun 2>/dev/null | grep -v "^Clean up complete"', clean: 'gem cleanup' },
  { name: 'NuGet', category: PM, tool: { bin: 'dotnet' }, paths: ['~/.nuget/packages'], list: 'dotnet nuget locals all --list', clean: 'dotnet nuget locals all --clear', sizePaths: ['~/.nuget/packages'], impact: 'redownload' },
  { name: 'Homebrew', category: PM, requires: ['brew'], list: 'HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ANALYTICS=1 brew cleanup --prune=all -n', clean: 'HOMEBREW_NO_AUTO_UPDATE=1 brew cleanup --prune=all -s', sizePaths: ['~/Library/Caches/Homebrew'] },
  { name: 'mise', category: PM, tool: brew('mise'), paths: ['~/.cache/mise', '~/Library/Caches/mise'], list: 'mise cache', clean: 'mise cache clear' },
  { name: 'pre-commit', category: PM, tool: brew('pre-commit'), paths: ['~/.cache/pre-commit'], clean: 'pre-commit clean' },
  { name: 'corepack', category: PM, paths: ['~/.cache/node/corepack'] },

  { name: 'Go build cache', category: TOOLCHAINS, tool: brew('go'), paths: ['~/Library/Caches/go-build', '~/.cache/go-build'], list: 'go env GOCACHE', clean: 'go clean -cache' },
  { name: 'Go module cache', category: TOOLCHAINS, tool: brew('go'), paths: ['~/go/pkg/mod'], list: 'go env GOMODCACHE', clean: 'go clean -modcache', impact: 'redownload', description: 'Every downloaded module; go build fetches them again.' },
  { name: 'Cargo registry', category: TOOLCHAINS, tool: brew('cargo-cache'), paths: ['~/.cargo/registry/cache', '~/.cargo/registry/src', '~/.cargo/git/checkouts'], clean: 'cargo cache --autoclean', description: 'cargo-cache keeps downloaded crates and drops extracted sources. Without it the folders are deleted and crates download again on the next build.' },
  { name: 'Gradle caches', category: TOOLCHAINS, paths: ['~/.gradle/caches', '~/.gradle/daemon'] },
  { name: 'Gradle wrapper distributions', category: TOOLCHAINS, paths: ['~/.gradle/wrapper/dists/*'], impact: 'redownload', description: 'Gradle versions used by wrappers, about 150M each to download again.' },
  { name: 'Maven repository', category: TOOLCHAINS, paths: ['~/.m2/repository'], impact: 'redownload', description: 'All downloaded artifacts, plus anything you mvn install-ed locally, which is lost.' },
  { name: 'node-gyp headers', category: TOOLCHAINS, paths: ['~/Library/Caches/node-gyp', '~/.cache/node-gyp'] },
  { name: 'Electron downloads', category: TOOLCHAINS, paths: ['~/Library/Caches/electron', '~/Library/Caches/electron-builder', '~/.cache/electron'] },
  { name: 'TypeScript', category: TOOLCHAINS, paths: ['~/Library/Caches/typescript'] },

  { name: 'Hugging Face models', category: BROWSERS, paths: ['~/.cache/huggingface/hub/models--*', '~/.cache/huggingface/hub/datasets--*'], impact: 'redownload', description: 'Downloaded again on next load; models are often several GB.' },
  { name: 'PyTorch hub', category: BROWSERS, paths: ['~/.cache/torch'], impact: 'redownload' },
  { name: 'Playwright browsers', category: BROWSERS, paths: ['~/Library/Caches/ms-playwright/*-*', '~/.cache/ms-playwright/*-*'], impact: 'redownload', description: 'Reinstall with npx playwright install.' },
  { name: 'Puppeteer browsers', category: BROWSERS, paths: ['~/.cache/puppeteer/*'], impact: 'redownload' },
  { name: 'Cypress binaries', category: BROWSERS, paths: ['~/Library/Caches/Cypress/*', '~/.cache/Cypress/*'], impact: 'redownload' },

  { name: 'Docker build cache', category: CONTAINERS, requires: ['docker'], list: docker('docker buildx du 2>/dev/null | tail -n 1'), clean: 'docker builder prune -af', impact: 'rebuild', description: 'Layer cache; the next docker build runs every step again.' },
  { name: 'Docker stopped containers', category: CONTAINERS, requires: ['docker'], list: docker(`docker ps -a --filter status=exited --filter status=created --filter status=dead --format '{{.Names}}  {{.Image}}  {{.Status}}  {{.Size}}'`), clean: 'docker container prune -f', impact: 'dataloss', description: 'Anything written inside these containers is lost.' },
  { name: 'Docker dangling images', category: CONTAINERS, requires: ['docker'], list: docker(`docker images -f dangling=true --format '{{.ID}}  {{.CreatedSince}}  {{.Size}}'`), clean: 'docker image prune -f', description: 'Untagged leftovers of earlier builds.' },
  { name: 'Docker unused images', category: CONTAINERS, requires: ['docker'], list: docker(DOCKER_UNUSED_IMAGES), clean: 'docker image prune -af', description: 'Every image no container uses; pulled again on next run', impact: 'redownload' },
  { name: 'Docker unused volumes', category: CONTAINERS, requires: ['docker'], list: docker(`docker volume ls -q -f dangling=true`), clean: 'docker volume prune -af', description: 'Volumes no container references. Their data is lost.', impact: 'dataloss' },
  { name: 'Docker unused networks', category: CONTAINERS, requires: ['docker'], list: docker(DOCKER_UNUSED_NETWORKS), clean: 'docker network prune -f' },
  { name: 'Podman unused data', category: CONTAINERS, requires: ['podman'], list: 'podman system df 2>/dev/null || true', clean: 'podman system prune -f', impact: 'dataloss', description: 'Stopped containers, unused images and build cache.' },

  { name: 'Xcode DerivedData', category: APPLE, paths: ['~/Library/Developer/Xcode/DerivedData/*'], impact: 'rebuild', description: 'Indexes and build products; Xcode rebuilds on next open.' },
  { name: 'Xcode Previews', category: APPLE, paths: ['~/Library/Developer/Xcode/UserData/Previews'] },
  { name: 'Xcode Archives', category: APPLE, paths: ['~/Library/Developer/Xcode/Archives/*'], description: 'Needed to symbolicate crash reports of shipped builds', impact: 'dataloss' },
  { name: 'Device support files', category: APPLE, paths: ['~/Library/Developer/Xcode/*DeviceSupport/*'], impact: 'redownload', description: 'Copied again from the device the next time it is connected.' },
  { name: 'Simulator caches', category: APPLE, paths: ['~/Library/Developer/CoreSimulator/Caches'] },
  { name: 'Unavailable simulators', category: APPLE, requires: ['xcrun'], list: 'xcrun simctl list devices unavailable | grep "(" || true', clean: 'xcrun simctl delete unavailable' },
  { name: 'SwiftPM cache', category: APPLE, paths: ['~/Library/Caches/org.swift.swiftpm'] },
  { name: 'Carthage cache', category: APPLE, paths: ['~/Library/Caches/org.carthage.CarthageKit'] },

  ...vscodeFamily,
  { name: 'JetBrains caches', category: EDITORS, paths: ['~/Library/Caches/JetBrains/*'], description: 'IDE indexes are rebuilt on next open', impact: 'rebuild' },
  { name: 'JetBrains logs', category: EDITORS, paths: ['~/Library/Logs/JetBrains/*'] },

  { name: 'XDG caches (~/.cache)', category: SYSTEM, paths: ['~/.cache/*'], fallback: true, description: 'Everything else in ~/.cache, including shell plugin caches. Review before selecting.', impact: 'unknown' },
  { name: 'User logs', category: SYSTEM, paths: ['~/Library/Logs/*'], fallback: true },
  { name: 'App caches (~/Library/Caches)', category: SYSTEM, paths: ['~/Library/Caches/*'], fallback: true, impact: 'unknown', description: 'Caches of apps putzteufel does not know. Most rebuild, some hold state such as offline data.' },
  { name: 'Installers in Downloads', category: SYSTEM, paths: ['~/Downloads/*.dmg', '~/Downloads/*.pkg'], impact: 'redownload' },
  { name: 'Trash', category: SYSTEM, paths: ['~/.Trash/*'], impact: 'dataloss', description: 'Same as emptying the Trash.' },
];
