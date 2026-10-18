import type { PluginSpec } from './plugins.ts';
import type { ProjectRule } from './projects.ts';

export const builtinRules: ProjectRule[] = [
  { name: 'Node', markers: ['package.json'], dirs: ['node_modules', '.angular', '.next', '.nuxt', '.output', '.svelte-kit', '.parcel-cache', '.turbo', '.expo', '.metro', '.docusaurus'] },
  { name: 'Node build output', markers: ['package.json'], dirs: ['dist', 'build', 'out', 'coverage', 'storybook-static'], safety: 'costly' },
  { name: 'React Native', markers: ['package.json'], dirs: ['android/build', 'android/.gradle', 'ios/build', 'ios/Pods', 'ios/DerivedData'] },
  { name: 'Python caches', dirs: ['__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.pytype', '.hypothesis', '.tox', '.nox', '__pypackages__', '.ipynb_checkpoints'] },
  { name: 'Python venv', contains: ['pyvenv.cfg'] },
  { name: 'Python build output', markers: ['pyproject.toml', 'setup.py', 'setup.cfg'], dirs: ['build', 'dist', '*.egg-info', '.eggs', 'htmlcov'], safety: 'costly' },
  { name: 'Pixi', markers: ['pixi.toml'], dirs: ['.pixi'] },
  { name: 'Cargo', markers: ['Cargo.toml'], dirs: ['target'], clean: 'cargo clean', requires: ['cargo'] },
  { name: 'Cargo xwin', markers: ['Cargo.toml'], dirs: ['.xwin-cache'] },
  { name: 'Maven', markers: ['pom.xml'], dirs: ['target'] },
  { name: 'Gradle', markers: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'], dirs: ['build', '.gradle'] },
  { name: 'SBT', markers: ['build.sbt'], dirs: ['target', 'project/target'] },
  { name: 'CMake', markers: ['CMakeLists.txt'], dirs: ['build', 'cmake-build-*'] },
  { name: 'Stack', markers: ['stack.yaml'], dirs: ['.stack-work'], clean: 'stack clean --full', requires: ['stack'] },
  { name: 'Cabal', markers: ['cabal.project'], dirs: ['dist-newstyle'], clean: 'cabal clean', requires: ['cabal'] },
  { name: 'Swift', markers: ['Package.swift'], dirs: ['.build'], clean: 'swift package reset', requires: ['swift'] },
  { name: 'Flutter', markers: ['pubspec.yaml'], dirs: ['build', '.dart_tool', 'linux/flutter/ephemeral', 'windows/flutter/ephemeral', 'macos/Flutter/ephemeral', 'ios/Flutter/ephemeral'], clean: 'flutter clean', requires: ['flutter'] },
  { name: 'Elixir', markers: ['mix.exs'], dirs: ['_build', 'deps', '.elixir-tools', '.elixir_ls', '.lexical'] },
  { name: 'Composer', markers: ['composer.json'], dirs: ['vendor'] },
  { name: 'Bundler', markers: ['Gemfile'], dirs: ['vendor/bundle'] },
  { name: 'Zig', markers: ['build.zig'], dirs: ['zig-cache', '.zig-cache', 'zig-out'] },
  { name: '.NET', markers: ['*.csproj', '*.fsproj'], dirs: ['bin', 'obj'] },
  { name: 'Unity', markers: ['ProjectSettings/ProjectVersion.txt'], dirs: ['Library', 'Temp', 'Obj', 'Logs', 'MemoryCaptures'] },
  { name: 'Unity builds', markers: ['ProjectSettings/ProjectVersion.txt'], dirs: ['Build', 'Builds'], safety: 'costly' },
  { name: 'Unreal', markers: ['*.uproject'], dirs: ['Binaries', 'DerivedDataCache', 'Intermediate'] },
  { name: 'Unreal saved and builds', markers: ['*.uproject'], dirs: ['Saved', 'Build'], safety: 'costly' },
  { name: 'Godot', markers: ['project.godot'], dirs: ['.godot'] },
  { name: 'Terraform', markers: ['.terraform.lock.hcl'], dirs: ['.terraform'] },
  { name: 'CocoaPods', markers: ['Podfile'], dirs: ['Pods'] },
];

const PM = 'Package managers';
const TOOLCHAINS = 'Toolchains';
const BROWSERS = 'Browsers, models & test runners';
const CONTAINERS = 'Containers';
const APPLE = 'Xcode & Apple';
const EDITORS = 'Editors & IDEs';
const SYSTEM = 'System';

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
  { name: 'uv', category: PM, requires: ['uv'], list: 'uv cache dir', clean: 'uv cache clean' },
  { name: 'pip', category: PM, requires: ['pip3'], list: 'pip3 cache dir', clean: 'pip3 cache purge' },
  { name: 'npm', category: PM, requires: ['npm'], list: 'echo "$(npm config get cache)/_cacache"', clean: 'npm cache clean --force' },
  { name: 'pnpm', category: PM, requires: ['pnpm'], list: 'pnpm store path', clean: 'pnpm store prune', description: 'Removes packages no project references' },
  { name: 'yarn', category: PM, requires: ['yarn'], list: 'yarn cache dir', clean: 'yarn cache clean' },
  { name: 'bun', category: PM, requires: ['bun'], list: 'bun pm cache', clean: 'bun pm cache rm' },
  { name: 'poetry', category: PM, requires: ['poetry'], list: 'd="$(poetry config cache-dir)" && echo "$d/cache" && echo "$d/artifacts"', clean: 'poetry cache list | xargs -n1 poetry cache clear --all -n' },
  { name: 'conda', category: PM, requires: ['conda'], list: 'echo "$(conda info --base)/pkgs"', clean: 'conda clean --all -y' },
  { name: 'deno', category: PM, requires: ['deno'], list: `deno info --json | sed -n 's/.*"denoDir": *"\\([^"]*\\)".*/\\1/p'`, clean: 'deno clean' },
  { name: 'Composer', category: PM, requires: ['composer'], list: 'composer config --global cache-dir', clean: 'composer clear-cache' },
  { name: 'CocoaPods', category: PM, requires: ['pod'], paths: ['~/Library/Caches/CocoaPods'], clean: 'pod cache clean --all' },
  { name: 'RubyGems old versions', category: PM, requires: ['gem'], list: 'gem cleanup --dryrun 2>/dev/null | grep -v "^Clean up complete"', clean: 'gem cleanup' },
  { name: 'NuGet', category: PM, requires: ['dotnet'], list: 'dotnet nuget locals all --list', clean: 'dotnet nuget locals all --clear', sizePaths: ['~/.nuget/packages'], safety: 'costly' },
  { name: 'Homebrew', category: PM, requires: ['brew'], list: 'HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ANALYTICS=1 brew cleanup --prune=all -n', clean: 'HOMEBREW_NO_AUTO_UPDATE=1 brew cleanup --prune=all -s', sizePaths: ['~/Library/Caches/Homebrew'] },
  { name: 'mise', category: PM, requires: ['mise'], list: 'mise cache', clean: 'mise cache clear' },
  { name: 'pre-commit', category: PM, requires: ['pre-commit'], paths: ['~/.cache/pre-commit'], clean: 'pre-commit clean' },
  { name: 'corepack', category: PM, paths: ['~/.cache/node/corepack'] },

  { name: 'Go build cache', category: TOOLCHAINS, requires: ['go'], list: 'go env GOCACHE', clean: 'go clean -cache' },
  { name: 'Go module cache', category: TOOLCHAINS, requires: ['go'], list: 'go env GOMODCACHE', clean: 'go clean -modcache', safety: 'costly' },
  { name: 'Cargo registry', category: TOOLCHAINS, requires: ['cargo-cache'], paths: ['~/.cargo/registry/cache', '~/.cargo/registry/src', '~/.cargo/git/checkouts'], clean: 'cargo cache --autoclean' },
  { name: 'Cargo registry files', category: TOOLCHAINS, paths: ['~/.cargo/registry/cache/*', '~/.cargo/registry/src/*', '~/.cargo/git/checkouts/*'], fallback: true, description: 'Used when cargo-cache is not installed' },
  { name: 'Gradle caches', category: TOOLCHAINS, paths: ['~/.gradle/caches', '~/.gradle/daemon'] },
  { name: 'Gradle wrapper distributions', category: TOOLCHAINS, paths: ['~/.gradle/wrapper/dists/*'], safety: 'costly' },
  { name: 'Maven repository', category: TOOLCHAINS, paths: ['~/.m2/repository'], safety: 'costly' },
  { name: 'node-gyp headers', category: TOOLCHAINS, paths: ['~/Library/Caches/node-gyp', '~/.cache/node-gyp'] },
  { name: 'Electron downloads', category: TOOLCHAINS, paths: ['~/Library/Caches/electron', '~/Library/Caches/electron-builder', '~/.cache/electron'] },
  { name: 'TypeScript', category: TOOLCHAINS, paths: ['~/Library/Caches/typescript'] },

  { name: 'Hugging Face models', category: BROWSERS, paths: ['~/.cache/huggingface/hub/models--*', '~/.cache/huggingface/hub/datasets--*'], safety: 'costly' },
  { name: 'PyTorch hub', category: BROWSERS, paths: ['~/.cache/torch'], safety: 'costly' },
  { name: 'Playwright browsers', category: BROWSERS, paths: ['~/Library/Caches/ms-playwright/*-*', '~/.cache/ms-playwright/*-*'], safety: 'costly' },
  { name: 'Puppeteer browsers', category: BROWSERS, paths: ['~/.cache/puppeteer/*'], safety: 'costly' },
  { name: 'Cypress binaries', category: BROWSERS, paths: ['~/Library/Caches/Cypress/*', '~/.cache/Cypress/*'], safety: 'costly' },

  { name: 'Docker build cache', category: CONTAINERS, requires: ['docker'], list: docker('docker buildx du 2>/dev/null | tail -n 1'), clean: 'docker builder prune -af' },
  { name: 'Docker stopped containers', category: CONTAINERS, requires: ['docker'], list: docker(`docker ps -a --filter status=exited --filter status=created --filter status=dead --format '{{.Names}}  {{.Image}}  {{.Status}}  {{.Size}}'`), clean: 'docker container prune -f', safety: 'costly' },
  { name: 'Docker dangling images', category: CONTAINERS, requires: ['docker'], list: docker(`docker images -f dangling=true --format '{{.ID}}  {{.CreatedSince}}  {{.Size}}'`), clean: 'docker image prune -f' },
  { name: 'Docker unused images', category: CONTAINERS, requires: ['docker'], list: docker(DOCKER_UNUSED_IMAGES), clean: 'docker image prune -af', safety: 'costly', description: 'Every image no container uses; pulled again on next run' },
  { name: 'Docker unused volumes', category: CONTAINERS, requires: ['docker'], list: docker(`docker volume ls -q -f dangling=true`), clean: 'docker volume prune -af', safety: 'costly', description: 'Volumes no container references. Their data is lost.' },
  { name: 'Docker unused networks', category: CONTAINERS, requires: ['docker'], list: docker(DOCKER_UNUSED_NETWORKS), clean: 'docker network prune -f' },
  { name: 'Podman unused data', category: CONTAINERS, requires: ['podman'], list: 'podman system df 2>/dev/null || true', clean: 'podman system prune -f', safety: 'costly' },

  { name: 'Xcode DerivedData', category: APPLE, paths: ['~/Library/Developer/Xcode/DerivedData/*'] },
  { name: 'Xcode Previews', category: APPLE, paths: ['~/Library/Developer/Xcode/UserData/Previews'] },
  { name: 'Xcode Archives', category: APPLE, paths: ['~/Library/Developer/Xcode/Archives/*'], safety: 'costly', description: 'Needed to symbolicate crash reports of shipped builds' },
  { name: 'Device support files', category: APPLE, paths: ['~/Library/Developer/Xcode/*DeviceSupport/*'], safety: 'costly' },
  { name: 'Simulator caches', category: APPLE, paths: ['~/Library/Developer/CoreSimulator/Caches'] },
  { name: 'Unavailable simulators', category: APPLE, requires: ['xcrun'], list: 'xcrun simctl list devices unavailable | grep "(" || true', clean: 'xcrun simctl delete unavailable' },
  { name: 'SwiftPM cache', category: APPLE, paths: ['~/Library/Caches/org.swift.swiftpm'] },
  { name: 'Carthage cache', category: APPLE, paths: ['~/Library/Caches/org.carthage.CarthageKit'] },

  ...vscodeFamily,
  { name: 'JetBrains caches', category: EDITORS, paths: ['~/Library/Caches/JetBrains/*'], safety: 'costly', description: 'IDE indexes are rebuilt on next open' },
  { name: 'JetBrains logs', category: EDITORS, paths: ['~/Library/Logs/JetBrains/*'] },

  { name: 'XDG caches (~/.cache)', category: SYSTEM, paths: ['~/.cache/*'], fallback: true, safety: 'costly', description: 'Everything else in ~/.cache, including shell plugin caches. Review before selecting.' },
  { name: 'User logs', category: SYSTEM, paths: ['~/Library/Logs/*'], fallback: true },
  { name: 'App caches (~/Library/Caches)', category: SYSTEM, paths: ['~/Library/Caches/*'], fallback: true, safety: 'costly' },
  { name: 'Installers in Downloads', category: SYSTEM, paths: ['~/Downloads/*.dmg', '~/Downloads/*.pkg'], safety: 'costly' },
  { name: 'Trash', category: SYSTEM, paths: ['~/.Trash/*'], safety: 'costly' },
];
