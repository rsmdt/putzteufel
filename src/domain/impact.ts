import { type Impact, type Target } from './types.ts';

export interface ImpactInfo {
  tag: string;
  color: string;
  meaning: string;
  preselected: boolean;
}

export const IMPACTS: Record<Impact, ImpactInfo> = {
  regenerates: { tag: 'regenerates', color: '#5fd787', meaning: 'The tool recreates it on its own when needed. Cheap to lose.', preselected: true },
  rebuild: { tag: 'rebuild', color: '#5fafd7', meaning: 'The next install or build recreates it. Costs time, nothing is lost.', preselected: true },
  redownload: { tag: 're-download', color: '#d7af5f', meaning: 'Fetched again from the network on next use. Costs bandwidth and time.', preselected: false },
  unknown: { tag: 'unknown', color: '#d787d7', meaning: 'putzteufel cannot tell whether anything recreates it. Review the files before selecting.', preselected: false },
  dataloss: { tag: 'data loss', color: '#ff5f5f', meaning: 'Cannot be recovered after removal.', preselected: false },
};

export const IMPACT_ORDER: Impact[] = ['regenerates', 'rebuild', 'redownload', 'unknown', 'dataloss'];

export function isRecent(target: Target, recentDays: number): boolean {
  return target.ageDays !== undefined && target.ageDays < recentDays;
}

export function isYounger(target: Target, recentDays: number, minAge: number): boolean {
  return (target.project !== undefined && isRecent(target, recentDays)) || isRecent(target, minAge);
}

export function preselect(target: Target, recentDays: number, minAge: number): boolean {
  return IMPACTS[target.impact].preselected && !isYounger(target, recentDays, minAge);
}
