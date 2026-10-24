import { GROUPS } from '../domain/groups.ts';
import { definePlugin } from './api.ts';

export default definePlugin({
  name: 'Homebrew',
  group: GROUPS.macos,
  items: [{ name: 'Old versions and downloads', requires: ['brew'], list: 'HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ANALYTICS=1 brew cleanup --prune=all -n', clean: 'HOMEBREW_NO_AUTO_UPDATE=1 brew cleanup --prune=all -s', sizePaths: ['~/Library/Caches/Homebrew'] }],
});
