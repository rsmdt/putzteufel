#!/usr/bin/env bun
import { main } from '../src/interfaces/cli/main.ts';

process.exitCode = await main();
