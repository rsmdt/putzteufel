import type { PluginSpec } from '../spec.ts';
import { docker } from './shared.ts';

const CONTAINERS = 'Containers';

const DOCKER_UNUSED_IMAGES = `{ docker ps -aq | xargs docker inspect --format 'USED {{.Image}}' 2>/dev/null; docker images --no-trunc --format '{{.ID}}  {{.Repository}}:{{.Tag}}  {{.Size}}'; } | awk '$1=="USED"{used[$2]=1; next} !used[$1]'`;

const DOCKER_UNUSED_NETWORKS = `{ docker ps -aq | xargs docker inspect --format '{{range .NetworkSettings.Networks}}USED {{.NetworkID}} {{end}}' 2>/dev/null | tr ' ' '\\n' | paste -d' ' - - ; docker network ls --no-trunc --filter type=custom --format '{{.ID}}  {{.Name}}  {{.Driver}}'; } | awk '$1=="USED"{used[$2]=1; next} NF && !used[$1]'`;

export const containers: PluginSpec[] = [
  { name: 'Docker build cache', category: CONTAINERS, requires: ['docker'], list: docker('docker buildx du 2>/dev/null | tail -n 1'), clean: 'docker builder prune -af', impact: 'rebuild', description: 'Layer cache; the next docker build runs every step again.' },
  { name: 'Docker stopped containers', category: CONTAINERS, requires: ['docker'], list: docker(`docker ps -a --filter status=exited --filter status=created --filter status=dead --format '{{.Names}}  {{.Image}}  {{.Status}}  {{.Size}}'`), clean: 'docker container prune -f', impact: 'dataloss', description: 'Anything written inside these containers is lost.' },
  { name: 'Docker dangling images', category: CONTAINERS, requires: ['docker'], list: docker(`docker images -f dangling=true --format '{{.ID}}  {{.CreatedSince}}  {{.Size}}'`), clean: 'docker image prune -f', description: 'Untagged leftovers of earlier builds.' },
  { name: 'Docker unused images', category: CONTAINERS, requires: ['docker'], list: docker(DOCKER_UNUSED_IMAGES), clean: 'docker image prune -af', description: 'Every image no container uses; pulled again on next run', impact: 'redownload' },
  { name: 'Docker unused volumes', category: CONTAINERS, requires: ['docker'], list: docker(`docker volume ls -q -f dangling=true`), clean: 'docker volume prune -af', description: 'Volumes no container references. Their data is lost.', impact: 'dataloss' },
  { name: 'Docker unused networks', category: CONTAINERS, requires: ['docker'], list: docker(DOCKER_UNUSED_NETWORKS), clean: 'docker network prune -f' },
  { name: 'Podman unused data', category: CONTAINERS, requires: ['podman'], list: 'podman system df 2>/dev/null || true', clean: 'podman system prune -f', impact: 'dataloss', description: 'Stopped containers, unused images and build cache.' },
];
