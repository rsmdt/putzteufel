import { GROUPS } from '../domain/groups.ts';
import { brew, definePlugin } from './api.ts';

export default definePlugin({
  name: 'Go',
  group: GROUPS.go,
  items: [
    { name: 'Build cache', tool: brew('go'), paths: ['~/Library/Caches/go-build', '~/.cache/go-build'], list: 'go env GOCACHE', clean: 'go clean -cache' },
    { name: 'Module cache', tool: brew('go'), paths: ['~/go/pkg/mod'], list: 'go env GOMODCACHE', clean: 'go clean -modcache', impact: 'redownload', description: 'Every downloaded module; go build fetches them again.' },
  ],
});
