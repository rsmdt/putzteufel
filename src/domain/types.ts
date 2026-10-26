export type Impact = 'regenerates' | 'rebuild' | 'redownload' | 'unknown' | 'dataloss';

export interface Command {
  run: string;
  cwd?: string;
}

export interface Tool {
  bin: string;
  installed: boolean;
  broken?: string;
  install?: string;
  uninstall?: string;
  clean: Command[];
}

export interface Hooks {
  before?: string;
  after?: string;
}

export interface Target {
  id: number;
  key: string;
  plugin: string;
  item?: string;
  group: string;
  label: string;
  paths: string[];
  identities?: Record<string, string>;
  sizePaths: string[];
  listed: string[];
  commands: Command[];
  impact: Impact;
  note?: string;
  tool?: Tool;
  hooks?: Hooks;
  size?: number;
  linkedBytes?: number;
  ageDays?: number;
  estimated?: boolean;
  partial?: boolean;
  touched?: boolean;
  project?: string;
  fallback?: boolean;
  selected: boolean;
}

export type TargetDraft = Partial<Omit<Target, 'id' | 'key' | 'selected'>> & { label: string };

export interface ScanContext {
  roots: string[];
  exclude: string[];
  olderThan: number;
  recentDays: number;
  signal: AbortSignal;
  note?: (detail: string) => void;
}

export interface Activity {
  id: string;
  kind: 'scan' | 'measure';
  label: string;
  plugins: string[];
  group?: string;
  targetId?: number;
  detail?: string;
  startedAt: number;
}

export type StepState = 'queued' | 'running' | 'done' | 'failed' | 'stopped';

export interface ScanStep {
  id: string;
  plugins: string[];
  targetId?: number;
  state: StepState;
  title: string;
  detail?: string;
  startedAt?: number;
  endedAt?: number;
}

export interface ScanProgress {
  running: Activity[];
  found: number;
  measured: number;
  waiting: number;
}

export type Emit = (draft: TargetDraft) => void;

export interface Plugin {
  name: string;
  item?: string;
  owners?: string[];
  group: string;
  description?: string;
  fallback?: boolean;
  tool?: { bin: string; install?: string };
  available(): Promise<boolean>;
  scan(ctx: ScanContext, emit: Emit): Promise<void>;
  measure(target: Target): Promise<void>;
}

export interface Entry {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  mtimeMs?: number;
}

export interface Estimate {
  size?: number;
  linkedBytes?: number;
  ageDays?: number;
  at: number;
}
