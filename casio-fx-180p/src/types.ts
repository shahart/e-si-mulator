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

export type ProgramStep = Exclude<
  Action,
  'shift' | 'mode' | 'runP1' | 'runP2' | 'clear' | 'execute'
>;

export interface KeyDefinition {
  label: string;
  action: Action;
  sub?: string;
  cls?: string;
}

export interface ImportedProgram {
  name: string;
  steps: ProgramStep[];
}
