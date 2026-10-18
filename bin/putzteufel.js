#!/usr/bin/env node

import { register } from 'tsx/esm/api';

register();

const { main } = await import('../src/cli.tsx');
process.exitCode = await main();
