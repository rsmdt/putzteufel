#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { main } from '../src/interfaces/cli/main.ts';

const code = await main();
await new Promise<void>((resolve) => process.stdout.write('', () => resolve()));
process.exit(code);
