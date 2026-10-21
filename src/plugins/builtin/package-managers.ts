import type { PluginSpec } from '../spec.ts';
import { brew } from './shared.ts';

const PM = 'Package managers';

export const packageManagers: PluginSpec[] = [
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
];
