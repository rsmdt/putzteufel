#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

register({ tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)) });
await import('../src/interfaces/cli/run.ts');
