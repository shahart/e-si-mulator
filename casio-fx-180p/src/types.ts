export type ProgramBank = 'P1' | 'P2';
export type CalculatorMode = 'RUN' | 'MODE' | 'LRN';
export type NumericKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export type Action =
  | NumericKey
  | 'shift'
  | 'mode'
  | 'runP1'
  | 'runP2'
  | 'clear'
  | 'sin'
  | 'cos'
  | 'tan'
  | 'square'
  | 'sqrt'
  | 'divide'
  | 'multiply'
  | 'subtract'
  | 'add'
  | 'equals'
  | 'decimal'
  | 'x'
  | 'pi'
  | 'negate'
  | 'execute';

// Atomic program operations produced by the calculator's multi-key sequences.
export type MemoryStep = `kin${1 | 2 | 3 | 4 | 5 | 6}` | `kout${1 | 2 | 3 | 4 | 5 | 6}`;
export type ProgramCommand = MemoryStep | 'min' | 'mr' | 'halt' | 'input' | 'return'
  | 'loopPositive' | 'loopLessEqual';
export type KeyAction = Action | ProgramCommand | 'kin' | 'kout';

export type ProgramStep = Exclude<
  Action,
  'shift' | 'mode' | 'runP1' | 'runP2' | 'clear' | 'execute'
> | ProgramCommand;

export interface KeyDefinition {
  label: string;
  action: KeyAction;
  sub?: string;
  cls?: string;
}

export interface ImportedProgram {
  name: string;
  steps: ProgramStep[];
}
