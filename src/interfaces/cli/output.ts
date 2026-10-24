import { SCHEMA_VERSION } from './serialize.ts';

export interface Output {
  json: boolean;
  event: (name: string, data: Record<string, unknown>) => void;
  line: (text: string) => void;
  warn: (text: string) => void;
}

export function output(json: boolean): Output {
  return {
    json,
    event: (name, data) => {
      if (json) process.stdout.write(`${JSON.stringify({ event: name, schema: SCHEMA_VERSION, ...data })}\n`);
    },
    line: (text) => {
      if (!json) console.log(text);
    },
    warn: (text) => {
      if (json) process.stdout.write(`${JSON.stringify({ event: 'warning', schema: SCHEMA_VERSION, message: text })}\n`);
      else console.error(`warning: ${text}`);
    },
  };
}
