import { GROUPS } from '../core/index.ts';
import { brew, definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Composer',
  group: GROUPS.php,
  projects: [{ name: 'vendor', markers: ['composer.json'], dirs: ['vendor'], description: 'Recreated by composer install.' }],
  items: [{ name: 'Cache', tool: brew('composer'), paths: ['~/Library/Caches/composer', '~/.composer/cache', '~/.cache/composer'], list: 'composer config --global cache-dir', clean: 'composer clear-cache' }],
});
