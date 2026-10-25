import { main } from './main.ts';

const code = await main();
await new Promise<void>((resolve) => process.stdout.write('', () => resolve()));
process.exit(code);
