#!/usr/bin/env bun
import { main } from '../src/cli.tsx';

process.exitCode = await main();
