export type CalculatorFunction =
  | 'inverse'
  | 'square'
  | 'sqrt'
  | 'sin'
  | 'cos'
  | 'tan'
  | 'asin'
  | 'acos'
  | 'atan'
  | 'log'
  | 'ln'
  | 'exp10'
  | 'exp';

export type KeyAction =
  | { kind: 'digit'; value: string }
  | { kind: 'operator'; value: string }
  | { kind: 'function'; value: CalculatorFunction }
  | { kind: 'memoryStore' }
  | { kind: 'memoryRead' }
  | { kind: 'execute' }
  | { kind: 'clear' }
  | { kind: 'clearAll' }
  | { kind: 'constant'; value: 'pi' }
  | { kind: 'negative' }
  | { kind: 'mode' }
  | { kind: 'shift' };

export interface KeyDefinition {
  label: string;
  action: KeyAction;
  sub?: string;
  shiftedAction?: KeyAction;
  cls?: 'shift' | 'execute';
}

export const keypadRows: KeyDefinition[][] = [
  [
    { label: 'SHIFT', action: { kind: 'shift' }, cls: 'shift' },
    { label: 'AC', action: { kind: 'clearAll' } },
    { label: 'MENU', action: { kind: 'mode' } },
    { label: 'EXIT', action: { kind: 'clear' } },
  ],
  [
    {
      label: 'sin',
      action: { kind: 'function', value: 'sin' },
      sub: 'sin⁻¹',
      shiftedAction: { kind: 'function', value: 'asin' },
    },
    {
      label: 'cos',
      action: { kind: 'function', value: 'cos' },
      sub: 'cos⁻¹',
      shiftedAction: { kind: 'function', value: 'acos' },
    },
    {
      label: 'tan',
      action: { kind: 'function', value: 'tan' },
      sub: 'tan⁻¹',
      shiftedAction: { kind: 'function', value: 'atan' },
    },
    { label: 'M in', action: { kind: 'memoryStore' } },
  ],
  [
    {
      label: 'log',
      action: { kind: 'function', value: 'log' },
      sub: '10^x',
      shiftedAction: { kind: 'function', value: 'exp10' },
    },
    {
      label: 'ln',
      action: { kind: 'function', value: 'ln' },
      sub: 'e^x',
      shiftedAction: { kind: 'function', value: 'exp' },
    },
    { label: 'x⁻¹', action: { kind: 'function', value: 'inverse' } },
    { label: 'M read', action: { kind: 'memoryRead' } },
  ],
  [
    {
      label: 'x²',
      action: { kind: 'function', value: 'square' },
      sub: '√',
      shiftedAction: { kind: 'function', value: 'sqrt' },
    },
    { label: '^', action: { kind: 'operator', value: '^' } },
    { label: 'π', action: { kind: 'constant', value: 'pi' } },
    { label: '(-)', action: { kind: 'negative' } },
  ],
  [
    { label: '7', action: { kind: 'digit', value: '7' } },
    { label: '8', action: { kind: 'digit', value: '8' } },
    { label: '9', action: { kind: 'digit', value: '9' } },
    { label: '÷', action: { kind: 'operator', value: '÷' } },
  ],
  [
    { label: '4', action: { kind: 'digit', value: '4' } },
    { label: '5', action: { kind: 'digit', value: '5' } },
    { label: '6', action: { kind: 'digit', value: '6' } },
    { label: '×', action: { kind: 'operator', value: '×' } },
  ],
  [
    { label: '1', action: { kind: 'digit', value: '1' } },
    { label: '2', action: { kind: 'digit', value: '2' } },
    { label: '3', action: { kind: 'digit', value: '3' } },
    { label: '−', action: { kind: 'operator', value: '−' } },
  ],
  [
    { label: '0', action: { kind: 'digit', value: '0' } },
    { label: '.', action: { kind: 'digit', value: '.' } },
    { label: 'EXE', action: { kind: 'execute' }, cls: 'execute' },
    { label: '+', action: { kind: 'operator', value: '+' } },
  ],
];

export function keyActionFor(key: KeyDefinition, shiftActive: boolean): KeyAction {
  return shiftActive && key.shiftedAction ? key.shiftedAction : key.action;
}

export function functionExpression(name: CalculatorFunction, input: string): string {
  const value = `(${input})`;

  switch (name) {
    case 'inverse': return `1/${value}`;
    case 'square': return `${value}^2`;
    case 'sqrt': return `SQRT${value}`;
    case 'sin': return `SIN${value}`;
    case 'cos': return `COS${value}`;
    case 'tan': return `TAN${value}`;
    case 'asin': return `ASIN${value}`;
    case 'acos': return `ACOS${value}`;
    case 'atan': return `ATAN${value}`;
    case 'log': return `LOG${value}`;
    case 'ln': return `LN${value}`;
    case 'exp10': return `10^${value}`;
    case 'exp': return `e^${value}`;
  }
}
