import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: '.NET',
  group: GROUPS.dotnet,
  projects: [{ name: 'bin and obj', markers: ['*.csproj', '*.fsproj'], dirs: ['bin', 'obj'] }],
  items: [{ name: 'NuGet packages', tool: { bin: 'dotnet' }, paths: ['~/.nuget/packages'], list: 'dotnet nuget locals all --list', clean: 'dotnet nuget locals all --clear', sizePaths: ['~/.nuget/packages'], impact: 'redownload' }],
});
