import type { Program } from './programs.js';
import { DEFAULT_VIEW_WINDOW, type GraphAction, type ViewWindow } from './graph.js';

export interface RunResult {
  lines: string[];
  variables: Record<string, number>;
  error: string;
  graph: GraphAction[];
  view: ViewWindow;
}

type StatementKind =
  | 'assign' | 'input' | 'disp' | 'clearText' | 'clearGraph'
  | 'view' | 'plot' | 'line' | 'if' | 'else' | 'ifEnd' | 'then'
  | 'for' | 'next' | 'while' | 'lpWhile' | 'whileEnd' | 'do'
  | 'goto' | 'label' | 'call' | 'return' | 'stop' | 'error'
  | 'conditionalGoto' | 'noop';

interface Statement {
  kind: StatementKind;
  text: string;
  line: number;
  value: string;
  args: string[];
  target: number;
  forIndex: number;
  whileIndex: number;
  on: boolean;
}

interface CompiledProgram {
  statements: Statement[];
  labels: Map<string, number>;
}

interface ForFrame {
  end: number;
  step: number;
}

interface Runtime {
  variables: Record<string, number>;
  output: string[];
  graph: GraphAction[];
  view: ViewWindow;
  input: (prompt: string) => number;
  programs: Program[];
  steps: number;
}

interface Block {
  kind: 'if' | 'for' | 'while' | 'do';
  index: number;
  elseIndex?: number;
}

const STEP_LIMIT = 500_000;
const CALL_LIMIT = 10;

const FUNCTIONS: Record<string, (value: number) => number> = {
  SIN: Math.sin,
  COS: Math.cos,
  TAN: Math.tan,
  ASIN: Math.asin,
  ACOS: Math.acos,
  ATAN: Math.atan,
  SQRT: Math.sqrt,
  ABS: Math.abs,
  LOG: Math.log10,
  LN: Math.log,
  EXP: Math.exp,
  INT: Math.floor,
  FRAC: (value) => value - Math.floor(value),
  SGN: Math.sign,
  ROUND: Math.round,
};

const BINARY_PRECEDENCE: Record<string, number> = {
  OR: 1,
  AND: 2,
  '=': 3,
  '<': 3,
  '>': 3,
  '<=': 3,
  '>=': 3,
  '<>': 3,
  '!=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  MOD: 5,
  '^': 6,
};

const TOKEN_PATTERN = /(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|<=|>=|<>|!=|[()+\-*/^<>=]/g;

function makeStatement(
  kind: StatementKind,
  text: string,
  line: number,
  extra: Partial<Statement> = {},
): Statement {
  return {
    kind,
    text,
    line,
    value: '',
    args: [],
    target: -1,
    forIndex: -1,
    whileIndex: -1,
    on: true,
    ...extra,
  };
}

function splitOutsideQuotes(text: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote = '';

  for (const character of text) {
    if (quote) {
      current += character;
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
      current += character;
    } else if (character === separator) {
      parts.push(current);
      current = '';
    } else {
      current += character;
    }
  }

  parts.push(current);
  return parts;
}

function stripComment(line: string): string {
  let quote = '';

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (quote) {
      if (character === quote) quote = '';
    } else if (character === "'" || (character === '/' && line[index + 1] === '/')) {
      return line.slice(0, index);
    } else if (character === '"') {
      quote = character;
    }
  }

  return line;
}

function parsePlainStatement(text: string, line: number): Statement {
  let match: RegExpMatchArray | null;

  if (/^ClrText$/i.test(text)) return makeStatement('clearText', text, line);
  if (/^(ClrGraph|Cls)$/i.test(text)) return makeStatement('clearGraph', text, line);

  match = text.match(/^ViewWindow\s+(.+)$/i);
  if (match) {
    return makeStatement('view', text, line, { args: splitOutsideQuotes(match[1], ',').map((part) => part.trim()) });
  }

  match = text.match(/^(PlotOn|PlotOff|Plot)\s+(.+)$/i);
  if (match) {
    return makeStatement('plot', text, line, {
      args: splitOutsideQuotes(match[2], ',').map((part) => part.trim()),
      on: match[1].toUpperCase() !== 'PLOTOFF',
    });
  }

  match = text.match(/^Line\s+(.+)$/i);
  if (match) {
    return makeStatement('line', text, line, { args: splitOutsideQuotes(match[1], ',').map((part) => part.trim()) });
  }

  match = text.match(/^Disp\s+(.+)$/i);
  if (match) return makeStatement('disp', text, line, { value: match[1].trim() });

  match = text.match(/^(?:If\s+)?(.+?)\s*(?:⇒|=>)\s*Goto\s+([A-Z0-9_]+)$/i);
  if (match) {
    return makeStatement('conditionalGoto', text, line, {
      value: match[1].trim(),
      args: [match[2].toUpperCase()],
    });
  }

  match = text.match(/^IfEnd$/i);
  if (match) return makeStatement('ifEnd', text, line);

  match = text.match(/^Else$/i);
  if (match) return makeStatement('else', text, line);

  match = text.match(/^Then$/i);
  if (match) return makeStatement('then', text, line);

  match = text.match(/^If\s+(.+)$/i);
  if (match) {
    const condition = match[1].replace(/\s+Then$/i, '').trim();
    return makeStatement('if', text, line, { value: condition });
  }

  match = text.match(/^Goto\s+([A-Z0-9_]+)$/i);
  if (match) return makeStatement('goto', text, line, { value: match[1].toUpperCase() });

  match = text.match(/^Lbl\s+([A-Z0-9_]+)$/i);
  if (match) return makeStatement('label', text, line, { value: match[1].toUpperCase() });

  if (/^Return$/i.test(text)) return makeStatement('return', text, line);
  if (/^Stop$/i.test(text)) return makeStatement('stop', text, line);

  match = text.match(/^Error(?:\s+(.+))?$/i);
  if (match) {
    const raw = (match[1] ?? '').trim();
    const message = /^"[^"]*"$/.test(raw) ? raw.slice(1, -1) : raw;
    return makeStatement('error', text, line, { value: message || 'Program error.' });
  }

  if (/^Do$/i.test(text)) return makeStatement('do', text, line);

  match = text.match(/^WhileEnd$/i);
  if (match) return makeStatement('whileEnd', text, line);

  match = text.match(/^LpWhile(?:\s+(.+))?$/i);
  if (match) return makeStatement('lpWhile', text, line, { value: (match[1] ?? '').trim() });

  match = text.match(/^While\s+(.+)$/i);
  if (match) return makeStatement('while', text, line, { value: match[1].trim() });

  match = text.match(/^Next(?:\s+[A-Z])?$/i);
  if (match) return makeStatement('next', text, line);

  match = text.match(/^For\s+([A-Z])\s*(?:->|→|=)\s*(.+?)\s+To\s+(.+?)(?:\s+Step\s+(.+))?$/i);
  if (match) {
    return makeStatement('for', text, line, {
      value: match[1].toUpperCase(),
      args: [match[2].trim(), match[3].trim(), (match[4] ?? '1').trim()],
    });
  }

  match = text.match(/^For\s+(.+?)\s*(?:->|→)\s*([A-Z])\s+To\s+(.+?)(?:\s+Step\s+(.+))?$/i);
  if (match) {
    return makeStatement('for', text, line, {
      value: match[2].toUpperCase(),
      args: [match[1].trim(), match[3].trim(), (match[4] ?? '1').trim()],
    });
  }

  match = text.match(/^Prog\s+["']?([A-Z][A-Z0-9_]*)["']?$/i);
  if (match) return makeStatement('call', text, line, { value: match[1].toUpperCase() });

  match = text.match(/^\?(?:"([^"]*)")?\s*(?:->|→)\s*([A-Z])$/i);
  if (match) {
    return makeStatement('input', text, line, {
      value: match[1] ?? `? ${match[2].toUpperCase()}=`,
      args: [match[2].toUpperCase()],
    });
  }

  match = text.match(/^"([^"]*)"\s*\?\s*(?:->|→)\s*([A-Z])$/i);
  if (match) {
    return makeStatement('input', text, line, { value: match[1], args: [match[2].toUpperCase()] });
  }

  match = text.match(/^(.+?)\s*(?:->|→)\s*([A-Z])$/i);
  if (match) {
    return makeStatement('assign', text, line, {
      value: match[1].trim(),
      args: [match[2].toUpperCase()],
    });
  }

  if (/^"[^"]*"$/.test(text)) return makeStatement('disp', text, line, { value: text });

  throw new Error(`Unsupported command: ${text}`);
}

function parseLine(raw: string, line: number): Statement[] {
  const cleaned = stripComment(raw);
  const statements: Statement[] = [];

  for (const piece of splitOutsideQuotes(cleaned, ':')) {
    const text = piece.trim();
    if (!text) continue;

    const inlineThen = text.match(/^If\s+(.+?)\s+Then\s+(.+)$/i);
    if (inlineThen) {
      statements.push(makeStatement('if', `If ${inlineThen[1]}`, line, { value: inlineThen[1].trim() }));
      statements.push(makeStatement('then', 'Then', line));
      statements.push(...parseLine(inlineThen[2], line));
      statements.push(makeStatement('ifEnd', 'IfEnd', line));
      continue;
    }

    const prefixed = text.match(/^(Then|Else)\s+(.+)$/i);
    if (prefixed) {
      const kind: StatementKind = prefixed[1].toUpperCase() === 'THEN' ? 'then' : 'else';
      statements.push(makeStatement(kind, prefixed[1], line));
      statements.push(...parseLine(prefixed[2], line));
      continue;
    }

    statements.push(parsePlainStatement(text, line));
  }

  return statements;
}

function compile(program: Program): CompiledProgram {
  const statements: Statement[] = [];

  program.source.forEach((raw, index) => {
    try {
      statements.push(...parseLine(raw, index + 1));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not parse this line.';
      throw new Error(`Line ${index + 1}: ${message}`);
    }
  });

  const stack: Block[] = [];

  statements.forEach((statement, index) => {
    const block = stack[stack.length - 1];

    switch (statement.kind) {
      case 'if':
        stack.push({ kind: 'if', index });
        break;

      case 'else': {
        if (!block || block.kind !== 'if') throw new Error(`Else without If on line ${statement.line}.`);
        statements[block.index].target = index + 1;
        block.elseIndex = index;
        break;
      }

      case 'ifEnd': {
        const opened = stack.pop();
        if (!opened || opened.kind !== 'if') throw new Error(`IfEnd without If on line ${statement.line}.`);
        if (opened.elseIndex === undefined) {
          statements[opened.index].target = index + 1;
        } else {
          statements[opened.elseIndex].target = index + 1;
        }
        break;
      }

      case 'for':
        stack.push({ kind: 'for', index });
        break;

      case 'next': {
        const opened = stack.pop();
        if (!opened || opened.kind !== 'for') throw new Error(`Next without For on line ${statement.line}.`);
        statements[opened.index].target = index + 1;
        statement.value = statements[opened.index].value;
        statement.forIndex = opened.index;
        break;
      }

      case 'while':
        stack.push({ kind: 'while', index });
        break;

      case 'do':
        stack.push({ kind: 'do', index });
        break;

      case 'lpWhile': {
        const opened = stack.pop();
        if (!opened || (opened.kind !== 'while' && opened.kind !== 'do')) {
          throw new Error(`LpWhile without While or Do on line ${statement.line}.`);
        }
        statement.whileIndex = opened.index;
        if (opened.kind === 'while') statements[opened.index].target = index + 1;
        break;
      }

      case 'whileEnd': {
        const opened = stack.pop();
        if (!opened || opened.kind !== 'while') throw new Error(`WhileEnd without While on line ${statement.line}.`);
        statement.whileIndex = opened.index;
        statements[opened.index].target = index + 1;
        break;
      }

      default:
        break;
    }
  });

  if (stack.length) {
    const opened = stack[0];
    throw new Error(`Unclosed ${opened.kind.toUpperCase()} block.`);
  }

  const labels = new Map<string, number>();
  statements.forEach((statement, index) => {
    if (statement.kind === 'label') labels.set(statement.value, index);
  });

  return { statements, labels };
}

function executeProgram(program: Program, runtime: Runtime, depth: number): void {
  if (depth > CALL_LIMIT) throw new Error('Subroutine nesting limit exceeded.');

  const { statements, labels } = compile(program);
  const frames: Array<ForFrame | undefined> = new Array(statements.length);
  let pc = 0;

  const evaluate = (expression: string): number => evaluateExpression(expression, runtime.variables);
  const jumpToLabel = (label: string): number => {
    const target = labels.get(label.toUpperCase());
    if (target === undefined) throw new Error(`Label ${label} not found.`);
    return target;
  };
  const displayValue = (source: string): string => {
    const text = source.trim();
    if (/^"[^"]*"$/.test(text)) return text.slice(1, -1);
    return formatNumber(evaluate(text));
  };

  while (pc < statements.length) {
    if (runtime.steps++ >= STEP_LIMIT) {
      throw new Error('Execution limit reached (possible infinite loop).');
    }

    const statement = statements[pc];

    switch (statement.kind) {
      case 'assign':
        runtime.variables[statement.args[0]] = evaluate(statement.value);
        pc++;
        break;

      case 'input':
        runtime.variables[statement.args[0]] = runtime.input(statement.value);
        pc++;
        break;

      case 'disp':
        runtime.output.push(splitOutsideQuotes(statement.value, ',').map(displayValue).join(' '));
        pc++;
        break;

      case 'clearText':
        runtime.output.length = 0;
        pc++;
        break;

      case 'clearGraph':
        runtime.graph.push({ kind: 'clear' });
        pc++;
        break;

      case 'view': {
        if (statement.args.length !== 6) throw new Error(`ViewWindow needs 6 values on line ${statement.line}.`);
        const [xMin, xMax, xScale, yMin, yMax, yScale] = statement.args.map(evaluate);
        if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || xMin >= xMax || yMin >= yMax) {
          throw new Error(`Invalid ViewWindow bounds on line ${statement.line}.`);
        }
        runtime.view = {
          xMin,
          xMax,
          xScale: xScale === 0 ? 1 : xScale,
          yMin,
          yMax,
          yScale: yScale === 0 ? 1 : yScale,
        };
        runtime.graph.push({ kind: 'view', window: { ...runtime.view } });
        pc++;
        break;
      }

      case 'plot': {
        if (statement.args.length < 2) throw new Error(`Plot needs X and Y on line ${statement.line}.`);
        runtime.graph.push({
          kind: 'plot',
          x: evaluate(statement.args[0]),
          y: evaluate(statement.args[1]),
          on: statement.on,
        });
        pc++;
        break;
      }

      case 'line': {
        if (statement.args.length < 4) throw new Error(`Line needs 4 coordinates on line ${statement.line}.`);
        runtime.graph.push({
          kind: 'line',
          x1: evaluate(statement.args[0]),
          y1: evaluate(statement.args[1]),
          x2: evaluate(statement.args[2]),
          y2: evaluate(statement.args[3]),
        });
        pc++;
        break;
      }

      case 'if':
        if (evaluate(statement.value) === 0 && statement.target >= 0) pc = statement.target;
        else pc++;
        break;

      case 'else':
        pc = statement.target >= 0 ? statement.target : pc + 1;
        break;

      case 'for': {
        const [startExpression, endExpression, stepExpression] = statement.args;
        const start = evaluate(startExpression);
        const end = evaluate(endExpression);
        const step = evaluate(stepExpression);
        if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0) {
          throw new Error(`Invalid For loop on line ${statement.line}.`);
        }
        runtime.variables[statement.value] = start;
        const shouldRun = step > 0 ? start <= end : start >= end;
        if (!shouldRun) {
          pc = statement.target >= 0 ? statement.target : pc + 1;
        } else {
          frames[pc] = { end, step };
          pc++;
        }
        break;
      }

      case 'next': {
        const frame = frames[statement.forIndex];
        if (!frame) throw new Error(`Next without an active For on line ${statement.line}.`);
        const current = runtime.variables[statement.value] + frame.step;
        runtime.variables[statement.value] = current;
        const keepGoing = frame.step > 0 ? current <= frame.end : current >= frame.end;
        if (keepGoing) {
          pc = statement.forIndex + 1;
        } else {
          frames[statement.forIndex] = undefined;
          pc++;
        }
        break;
      }

      case 'while':
        if (evaluate(statement.value) === 0 && statement.target >= 0) pc = statement.target;
        else pc++;
        break;

      case 'lpWhile': {
        const condition = statement.value
          ? evaluate(statement.value)
          : evaluate(statements[statement.whileIndex].value);
        pc = condition !== 0 ? statement.whileIndex + 1 : pc + 1;
        break;
      }

      case 'whileEnd': {
        const condition = evaluate(statements[statement.whileIndex].value);
        pc = condition !== 0 ? statement.whileIndex + 1 : pc + 1;
        break;
      }

      case 'goto':
        pc = jumpToLabel(statement.value);
        break;

      case 'conditionalGoto':
        if (evaluate(statement.value) !== 0) pc = jumpToLabel(statement.args[0]);
        else pc++;
        break;

      case 'call': {
        const called = runtime.programs.find(
          (candidate) => candidate.name.toUpperCase() === statement.value.toUpperCase(),
        );
        if (!called) throw new Error(`Program ${statement.value} not found.`);
        executeProgram(called, runtime, depth + 1);
        pc++;
        break;
      }

      case 'return':
      case 'stop':
        return;

      case 'error':
        throw new Error(statement.value);

      default:
        pc++;
        break;
    }
  }
}

export function runProgram(
  program: Program,
  programs: Program[],
  input: (prompt: string) => number = () => 0,
  initialVariables: Record<string, number> = {},
): RunResult {
  const runtime: Runtime = {
    variables: Object.fromEntries(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((key) => [key, 0]),
    ),
    output: [],
    graph: [],
    view: { ...DEFAULT_VIEW_WINDOW },
    input,
    programs,
    steps: 0,
  };

  for (const [name, value] of Object.entries(initialVariables)) {
    if (/^[A-Z]$/.test(name) && Number.isFinite(value)) runtime.variables[name] = value;
  }

  let error = '';
  try {
    if (program) executeProgram(program, runtime, 0);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Program error.';
  }

  return {
    lines: [...runtime.output],
    variables: { ...runtime.variables },
    error,
    graph: runtime.graph,
    view: { ...runtime.view },
  };
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
    .replace(/−/g, '-')
    .replace(/\*\*/g, '^');

  const tokens = normalized.match(TOKEN_PATTERN) ?? [];
  if (!tokens.length) throw new Error('Expected an expression.');

  let position = 0;
  const keyword = (token: string): string => token.toUpperCase();
  const peek = (): string => tokens[position] ?? '';
  const take = (): string => tokens[position++];
  const canStartValue = (token: string): boolean => token !== ''
    && (/^[\d.]/.test(token) || /^[A-Za-z_]/.test(token) || token === '(');

  const parsePrimary = (token: string): number => {
    if (token === '(') {
      const value = expression(0);
      if (take() !== ')') throw new Error('Missing closing parenthesis.');
      return value;
    }

    if (/^(?:\d|\.)/.test(token)) return Number(token);

    if (/^[A-Za-z_]/.test(token)) {
      const key = keyword(token);
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

  const parseUnary = (): number => {
    const token = take();
    const key = keyword(token);

    if (key === '+' || key === '-') {
      const value = parseUnary();
      return key === '-' ? -value : value;
    }

    if (key === 'NOT') {
      return parseUnary() === 0 ? 1 : 0;
    }

    return parsePrimary(token);
  };

  const applyOperator = (operator: string, left: number, right: number): number => {
    switch (operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case '^': return left ** right;
      case 'MOD': return left % right;
      case '=': return Number(left === right);
      case '<': return Number(left < right);
      case '>': return Number(left > right);
      case '<=': return Number(left <= right);
      case '>=': return Number(left >= right);
      case '<>':
      case '!=': return Number(left !== right);
      case 'AND': return Number(left !== 0 && right !== 0);
      case 'OR': return Number(left !== 0 || right !== 0);
      default: throw new Error(`Unknown operator ${operator}.`);
    }
  };

  const expression = (minimumPrecedence: number): number => {
    let left = parseUnary();

    for (;;) {
      const token = peek();
      let operator = keyword(token);
      let precedence = BINARY_PRECEDENCE[operator];
      let implicit = false;

      if (precedence === undefined && canStartValue(token)) {
        operator = '*';
        precedence = BINARY_PRECEDENCE[operator];
        implicit = true;
      }

      if (precedence === undefined || precedence < minimumPrecedence) break;
      if (!implicit) take();

      const right = expression(operator === '^' ? precedence : precedence + 1);
      left = applyOperator(operator, left, right);
    }

    return left;
  };

  const result = expression(0);
  if (position !== tokens.length) throw new Error(`Unexpected token ${peek()}.`);
  return result;
}
