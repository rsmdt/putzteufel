import type { PluginSpec } from '../spec.ts';

const BROWSERS = 'Browsers, models & test runners';

export const modelsAndBrowsers: PluginSpec[] = [
  { name: 'Hugging Face models', category: BROWSERS, paths: ['~/.cache/huggingface/hub/models--*', '~/.cache/huggingface/hub/datasets--*'], impact: 'redownload', description: 'Downloaded again on next load; models are often several GB.' },
  { name: 'PyTorch hub', category: BROWSERS, paths: ['~/.cache/torch'], impact: 'redownload' },
  { name: 'Playwright browsers', category: BROWSERS, paths: ['~/Library/Caches/ms-playwright/*-*', '~/.cache/ms-playwright/*-*'], impact: 'redownload', description: 'Reinstall with npx playwright install.' },
  { name: 'Puppeteer browsers', category: BROWSERS, paths: ['~/.cache/puppeteer/*'], impact: 'redownload' },
  { name: 'Cypress binaries', category: BROWSERS, paths: ['~/Library/Caches/Cypress/*', '~/.cache/Cypress/*'], impact: 'redownload' },
];
