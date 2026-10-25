import type { Tool } from '../domain/types.ts';
import { forgetWhich, shell, which } from '../infrastructure/shell.ts';

export const INSTALL_TIMEOUT = 30 * 60_000;

export interface ToolResult {
  ok: boolean;
  error?: string;
}

function errorText(e: Error & { stderr?: string }): string {
  return (e.stderr || e.message).trim().slice(-400);
}

export async function installTool(tool: Tool, signal?: AbortSignal): Promise<ToolResult> {
  if (!tool.install) return { ok: false, error: `no install command known for ${tool.bin}` };
  const failed = await shell(tool.install, undefined, INSTALL_TIMEOUT, signal).then(
    () => undefined,
    (e: Error & { stderr?: string }) => errorText(e),
  );
  forgetWhich();
  if (failed) return { ok: false, error: failed };
  return (await which(tool.bin)) ? { ok: true } : { ok: false, error: `finished, but ${tool.bin} is still not on PATH` };
}

export async function uninstallTool(tool: Tool): Promise<ToolResult> {
  if (!tool.uninstall) return { ok: false, error: `no uninstall command known for ${tool.bin}` };
  const result = await shell(tool.uninstall, undefined, INSTALL_TIMEOUT).then(
    () => ({ ok: true }),
    (e: Error & { stderr?: string }) => ({ ok: false, error: errorText(e) }),
  );
  forgetWhich();
  return result;
}
