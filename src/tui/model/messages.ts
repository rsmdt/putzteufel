export type Level = 'info' | 'warn' | 'error';

export interface Message {
  text: string;
  level: Level;
  at: number;
}

export function message(text: string, level: Level = 'info'): Message {
  return { text: text.replace(/\s*\n\s*/g, ' · ').trim(), level, at: Date.now() };
}

export function clock(at: number): string {
  return new Date(at).toTimeString().slice(0, 8);
}
