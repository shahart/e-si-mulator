import type { Program } from './programs.js';

export interface RunResult {
  lines: string[];
  variables: Record<string, number>;
  error: string;
}

const FUNCTIONS: Record<string, (value: number) => number> = {
  SIN: Math.sin,
  COS: Math.cos,
  TAN: Math.tan,
  SQRT: Math.sqrt,
  ABS: Math.abs,
  LOG: Math.log10,
  LN: Math.log,
  EXP: Math.exp,
};

export function runProgram(
  program: Program,
  programs: Program[],
  input: (prompt: string) => number = () => 0,
): RunResult {
  const lines = [...program.source];
  const output: string[] = [];
  const variables: Record<string, number> = Object.fromEntries(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((key) => [key, 0]),
  );
  const labels = new Map<string, number>();

  lines.forEach((line, index) => {
    const match = line.match(/^Lbl\s+([A-Z0-9]+)/i);
    if (match) labels.set(match[1].toUpperCase(), index);
  });

  let programCounter = 0;
  let steps = 0;
  let error = '';

  const target = (label: string): number => {
    const found = labels.get(label.toUpperCase());
    if (found === undefined) throw new Error(`Label ${label} not found.`);
    return found;
  };

  const execute = (source: string, depth = 0): void => {
    if (depth > 10) throw new Error('Subroutine nesting limit exceeded.');

    for (const raw of source.split(':')) {
      const line = raw.trim();
      if (!line) continue;

      let match: RegExpMatchArray | null;
      if (/^Lbl\s+/i.test(line)) continue;

      match = line.match(/^(?:If\s+)?(.+?)\s*(?:⇒|=>)\s*Goto\s+([A-Z0-9]+)/i);
      if (match) {
        if (evaluateExpression(match[1], variables) !== 0) programCounter = target(match[2]);
        continue;
      }

      match = line.match(/^If\s+(.+?)\s+Then$/i);
      if (match) {
        if (evaluateExpression(match[1], variables) === 0) {
          while (programCounter + 1 < lines.length && !/^IfEnd/i.test(lines[programCounter + 1])) {
            programCounter++;
          }
          programCounter++;
        }
        continue;
      }

      if (/^IfEnd$/i.test(line)) continue;

      match = line.match(/^Goto\s+([A-Z0-9]+)/i);
      if (match) {
        programCounter = target(match[1]);
        continue;
      }

      match = line.match(/^Prog\s+["']?([A-Z][A-Z0-9_]*)["']?$/i);
      if (match) {
        const called = programs.find((item) => item.name.toUpperCase() === match![1].toUpperCase());
        if (!called) throw new Error(`Program ${match[1]} not found.`);
        output.push(...runProgram(called, programs, input).lines);
        continue;
      }

      if (/^Return$/i.test(line)) return;

      match = line.match(/^\?(?:"([^"]*)")?\s*→\s*([A-Z])$/i);
      if (match) {
        variables[match[2].toUpperCase()] = input(match[1] ?? `? ${match[2]}=`);
        continue;
      }

      match = line.match(/^Disp\s+(.+)$/i);
      if (match) {
        output.push(formatNumber(evaluateExpression(match[1], variables)));
        continue;
      }

      match = line.match(/^"([^"]*)"$/);
      if (match) {
        output.push(match[1]);
        continue;
      }

      match = line.match(/^(.+?)\s*→\s*([A-Z])$/i);
      if (match) {
        variables[match[2].toUpperCase()] = evaluateExpression(match[1], variables);
        continue;
      }

      if (/^(?:Stop|Cls)$/i.test(line)) return;
      throw new Error(`Unsupported command: ${line}`);
    }
  };

  try {
    while (programCounter < lines.length && steps++ < 10_000) {
      execute(lines[programCounter]);
      programCounter++;
    }
    if (steps >= 10_000) throw new Error('Execution limit reached (possible infinite loop).');
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Program error.';
  }

  return { lines: output, variables, error };
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toPrecision(10)).toString() : 'Math ERROR';
}

export function evaluateExpression(
  source: string,
  variables: Record<string, number> = {},
): number {
  const normalized = source
    .replace(/π/g, 'PI')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
  const tokens = normalized.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?|[A-Za-z]+|[()+\-*/^<>=]/g) ?? [];
  if (!tokens.length) throw new Error('Expected an expression.');

  let position = 0;
  const peek = (): string => tokens[position] ?? '';
  const take = (): string => tokens[position++];

  const primary = (): number => {
    const token = take();

    if (token === '+' || token === '-') {
      const value = primary();
      return token === '-' ? -value : value;
    }

    if (token === '(') {
      const value = expression(0);
      if (take() !== ')') throw new Error('Missing closing parenthesis.');
      return value;
    }

    if (/^\d/.test(token) || /^\./.test(token)) return Number(token);

    if (/^[A-Za-z]+$/.test(token)) {
      const key = token.toUpperCase();
      if (peek() === '(' && FUNCTIONS[key]) {
        take();
        const value = expression(0);
        if (take() !== ')') throw new Error('Missing closing parenthesis.');
        return FUNCTIONS[key](value);
      }
      if (key === 'PI') return Math.PI;
      if (key === 'E') return Math.E;
      if (key.length === 1 && key in variables) return variables[key];
      throw new Error(`Unknown variable ${token}.`);
    }

    throw new Error(`Unexpected expression token ${token || 'end'}.`);
  };

  const precedence: Record<string, number> = {
    '=': 1,
    '<': 1,
    '>': 1,
    '+': 2,
    '-': 2,
    '*': 3,
    '/': 3,
    '^': 4,
  };

  const expression = (minimumPrecedence: number): number => {
    let left = primary();

    while (precedence[peek()] >= minimumPrecedence) {
      const operator = take();
      const operatorPrecedence = precedence[operator];
      const right = expression(operatorPrecedence + (operator === '^' ? 0 : 1));

      if (operator === '+') left += right;
      else if (operator === '-') left -= right;
      else if (operator === '*') left *= right;
      else if (operator === '/') left /= right;
      else if (operator === '^') left **= right;
      else if (operator === '<') left = Number(left < right);
      else if (operator === '>') left = Number(left > right);
      else left = Number(left === right);
    }

    return left;
  };

  const result = expression(1);
  if (position !== tokens.length) throw new Error(`Unexpected token ${peek()}.`);
  return result;
}
