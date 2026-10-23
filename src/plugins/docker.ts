import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

const whenRunning = (list: string) => `if docker info >/dev/null 2>&1; then ${list}; fi`;

const UNUSED_IMAGES = `{ docker ps -aq | xargs docker inspect --format 'USED {{.Image}}' 2>/dev/null; docker images --no-trunc --format '{{.ID}}  {{.Repository}}:{{.Tag}}  {{.Size}}'; } | awk '$1=="USED"{used[$2]=1; next} !used[$1]'`;

const UNUSED_NETWORKS = `{ docker ps -aq | xargs docker inspect --format '{{range .NetworkSettings.Networks}}USED {{.NetworkID}} {{end}}' 2>/dev/null | tr ' ' '\\n' | paste -d' ' - - ; docker network ls --no-trunc --filter type=custom --format '{{.ID}}  {{.Name}}  {{.Driver}}'; } | awk '$1=="USED"{used[$2]=1; next} NF && !used[$1]'`;

export default definePlugin({
  name: 'Docker',
  group: GROUPS.containers,
  description: 'Everything Docker keeps: build cache, containers, images, volumes and networks, each listed and pruned with docker itself.',
  items: [
    { name: 'Build cache', requires: ['docker'], list: whenRunning('docker buildx du 2>/dev/null | tail -n 1'), clean: 'docker builder prune -af', impact: 'rebuild', description: 'Layer cache; the next docker build runs every step again.' },
    { name: 'Stopped containers', requires: ['docker'], list: whenRunning(`docker ps -a --filter status=exited --filter status=created --filter status=dead --format '{{.Names}}  {{.Image}}  {{.Status}}  {{.Size}}'`), clean: 'docker container prune -f', impact: 'dataloss', description: 'Anything written inside these containers is lost.' },
    { name: 'Dangling images', requires: ['docker'], list: whenRunning(`docker images -f dangling=true --format '{{.ID}}  {{.CreatedSince}}  {{.Size}}'`), clean: 'docker image prune -f', description: 'Untagged leftovers of earlier builds.' },
    { name: 'Unused images', requires: ['docker'], list: whenRunning(UNUSED_IMAGES), clean: 'docker image prune -af', description: 'Every image no container uses; pulled again on next run', impact: 'redownload' },
    { name: 'Unused volumes', requires: ['docker'], list: whenRunning(`docker volume ls -q -f dangling=true`), clean: 'docker volume prune -af', description: 'Volumes no container references. Their data is lost.', impact: 'dataloss' },
    { name: 'Unused networks', requires: ['docker'], list: whenRunning(UNUSED_NETWORKS), clean: 'docker network prune -f' },
  ],
});
