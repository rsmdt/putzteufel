import { describeCommand } from './command.ts';
import { human } from './format.ts';
import { uniqueSize } from './overlap.ts';
import { missingTools } from './run-plan.ts';
import type { Target, Tool } from './types.ts';

export interface Suggestion {
  tool: Tool;
  targets: Target[];
  size: number;
  reason: string;
}

export function toolSuggestions(targets: Target[]): Suggestion[] {
  return missingTools(targets).map((tool) => {
    const using = targets.filter((t) => t.tool?.bin === tool.bin && !t.tool.installed);
    const size = uniqueSize(using);
    const plugins = [...new Set(using.map((t) => t.plugin))].join(', ');
    const clean = tool.clean[0] ? describeCommand(tool.clean[0]) : 'its own command';
    return { tool, targets: using, size, reason: `${tool.bin} would clean ${plugins} (${human(size)}) with ${clean} instead of deleting the folders` };
  });
}
