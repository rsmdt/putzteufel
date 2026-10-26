import { GROUPS } from '../domain/groups.ts';
import { type TargetDraft } from '../domain/types.ts';
import { subfolders } from '../infrastructure/fs.ts';
import { expand } from '../infrastructure/plugins/items.ts';
import { execFileAsync } from '../infrastructure/shell.ts';
import { definePlugin } from './api.ts';

const KEEP_DEVICE_SUPPORT = 2;

interface RuntimeImage {
  runtimeIdentifier?: string;
  version?: string;
  build?: string;
  sizeBytes?: number;
  deletable?: boolean;
  state?: string;
}

export async function oldDeviceSupport(pattern = '~/Library/Developer/Xcode/*DeviceSupport'): Promise<TargetDraft[]> {
  const drafts: TargetDraft[] = [];
  for (const root of await expand(pattern)) {
    const versions = (await subfolders(root)).sort((a, b) => b.mtimeMs - a.mtimeMs);
    drafts.push(...versions.slice(KEEP_DEVICE_SUPPORT).map((v) => ({ label: v.path, paths: [v.path] })));
  }
  return drafts;
}

export function unusedRuntimes(images: Record<string, RuntimeImage>, devices: { devices?: Record<string, unknown[]> }): TargetDraft[] {
  if (!devices.devices) return [];
  const served = new Map<string, number>();
  for (const image of Object.values(images)) if (image.runtimeIdentifier) served.set(image.runtimeIdentifier, (served.get(image.runtimeIdentifier) ?? 0) + 1);
  return Object.entries(images)
    .filter(([, i]) => i.state === 'Ready' && i.deletable === true && i.runtimeIdentifier && served.get(i.runtimeIdentifier) === 1 && !devices.devices![i.runtimeIdentifier]?.length)
    .map(([id, i]) => {
      const platform = i.runtimeIdentifier!.split('.').at(-1)!.split('-')[0] || 'Simulator';
      const label = `${platform} ${i.version ?? ''}${i.build ? ` (${i.build})` : ''}`.trim();
      return { label, listed: [`${label}  ${id}`], size: i.sizeBytes, commands: [{ run: `xcrun simctl runtime delete ${id}` }] };
    });
}

async function simulatorRuntimes(): Promise<TargetDraft[]> {
  const ready = await execFileAsync('xcodebuild', ['-checkFirstLaunchStatus'], { timeout: 30_000 }).then(
    () => true,
    () => false,
  );
  if (!ready) return [];
  const json = async (args: string[]) => JSON.parse((await execFileAsync('xcrun', ['simctl', ...args, '-j'], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 })).stdout);
  return unusedRuntimes(await json(['runtime', 'list']), await json(['list', 'devices']));
}

export default definePlugin({
  name: 'Xcode',
  group: GROUPS.apple,
  items: [
    { name: 'DerivedData', paths: ['~/Library/Developer/Xcode/DerivedData/*'], impact: 'rebuild', description: 'Indexes and build products; Xcode rebuilds on next open.' },
    { name: 'Previews', paths: ['~/Library/Developer/Xcode/UserData/Previews'] },
    { name: 'Archives', paths: ['~/Library/Developer/Xcode/Archives/*'], description: 'Needed to symbolicate crash reports of shipped builds', impact: 'dataloss' },
    { name: 'Device support files', scan: () => oldDeviceSupport(), impact: 'redownload', description: `Older OS versions only; the ${KEEP_DEVICE_SUPPORT} newest per platform are kept. Copied again from the device the next time it is connected.` },
    { name: 'Simulator caches', paths: ['~/Library/Developer/CoreSimulator/Caches'] },
    { name: 'Unavailable simulators', requires: ['xcrun'], list: 'xcrun simctl list devices unavailable | grep "(" || true', clean: 'xcrun simctl delete unavailable' },
    { name: 'Unused simulator runtimes', requires: ['xcrun', 'xcodebuild'], scan: () => simulatorRuntimes(), impact: 'redownload', description: 'Runtimes no simulator uses. Xcode downloads them again when you add a simulator for that OS.' },
  ],
});
