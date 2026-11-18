import type {
  Action,
  CalculatorMode,
  ProgramBank,
  ProgramStep,
} from './types.js';

type PressSource = 'normal' | 'recording' | 'replay';
type Operation = 'add' | 'subtract' | 'multiply' | 'divide';
type InverseFunction = 'asin' | 'acos' | 'atan';

export interface CalculatorState {
  display: number | string;
  accumulator: number | null;
  pending: Operation | null;
  fresh: boolean;
  mode: CalculatorMode;
  bank: ProgramBank;
  angle: 'DEG' | 'RAD';
  shift: boolean;
  programs: Record<ProgramBank, ProgramStep[]>;
  inputX: boolean;
  inputValue: number;
  error: string;
}

const MAX_PROGRAM_STEPS = 38;

export class Calculator {
  readonly state: CalculatorState = {
    display: '0',
    accumulator: null,
    pending: null,
    fresh: true,
    mode: 'RUN',
    bank: 'P1',
    angle: 'DEG',
    shift: false,
    programs: { P1: [], P2: [] },
    inputX: false,
    inputValue: 0,
    error: '',
  };

  get totalSteps(): number {
    return this.state.programs.P1.length + this.state.programs.P2.length;
  }

  get availableSteps(): number {
    return MAX_PROGRAM_STEPS - this.state.programs[this.otherBank].length;
  }

  private get otherBank(): ProgramBank {
    return this.state.bank === 'P1' ? 'P2' : 'P1';
  }

  press(action: Action, source: PressSource = 'normal'): void {
    const state = this.state;
    state.error = '';

    if (action === 'shift') {
      state.shift = !state.shift;
      return;
    }

    if (action === 'mode') {
      state.mode = state.mode === 'RUN' ? 'MODE' : 'RUN';
      return;
    }

    if (state.mode === 'MODE' && action === '0') {
      state.mode = 'LRN';
      state.bank = 'P1';
      state.programs = { P1: [], P2: [] };
      state.accumulator = null;
      state.display = '0';
      return;
    }

    if (state.mode === 'LRN' && action === 'runP1') {
      state.bank = 'P1';
      return;
    }

    if (state.mode === 'LRN' && action === 'runP2') {
      state.bank = 'P2';
      return;
    }

    if (state.mode === 'LRN' && action === 'clear') {
      state.programs[state.bank] = [];
      return;
    }

    if (action === 'runP1' || action === 'runP2') {
      this.runProgram(action === 'runP1' ? 'P1' : 'P2');
      return;
    }

    if (action === 'clear') {
      state.display = '0';
      state.accumulator = null;
      state.pending = null;
      state.fresh = true;
      return;
    }

    if (state.mode === 'LRN' && source === 'normal') {
      if (this.totalSteps >= MAX_PROGRAM_STEPS) {
        state.error = 'MEM FULL';
        return;
      }

      if (action === 'execute') return;

      state.programs[state.bank].push(action as ProgramStep);
      source = 'recording';
    }

    this.enterDigitOrDecimal(action);
    this.enterOperation(action);
    this.enterSpecialKey(action, source);
  }

  selectBank(bank: ProgramBank): void {
    this.state.bank = bank;
  }

  clearProgram(bank: ProgramBank = this.state.bank): void {
    this.state.programs[bank] = [];
  }

  loadProgram(bank: ProgramBank, steps: ProgramStep[]): void {
    this.state.programs[bank] = [...steps];
    this.state.bank = bank;
    this.state.mode = 'RUN';
  }

  private runProgram(bank: ProgramBank): void {
    const state = this.state;
    state.bank = bank;
    state.mode = 'RUN';
    state.inputValue = this.currentValue();
    state.inputX = true;
    state.fresh = true;

    for (const step of state.programs[bank]) {
      this.press(step, 'replay');
    }
  }

  private currentValue(): number {
    return Number(this.state.display) || 0;
  }

  private setDisplay(value: number): void {
    this.state.display = Number.isFinite(value) ? value : 'Math Error';
    this.state.fresh = true;
  }

  private stepCalculation(operation: Operation, left: number, right: number): number {
    switch (operation) {
      case 'add':
        return left + right;
      case 'subtract':
        return left - right;
      case 'multiply':
        return left * right;
      case 'divide':
        return left / right;
    }
  }

  private enterDigitOrDecimal(action: Action): void {
    const state = this.state;

    if (/^[0-9]$/.test(action)) {
      if (state.fresh) {
        state.display = action;
      } else {
        state.display = state.display === '0' ? action : `${state.display}${action}`;
      }
      state.fresh = false;
      return;
    }

    if (action === 'decimal') {
      if (state.fresh) {
        state.display = '0.';
      } else if (!String(state.display).includes('.')) {
        state.display = `${state.display}.`;
      }
      state.fresh = false;
    }
  }

  private enterOperation(action: Action): void {
    const state = this.state;
    const operations: Operation[] = ['add', 'subtract', 'multiply', 'divide'];

    if (operations.includes(action as Operation)) {
      const operation = action as Operation;
      if (state.pending) {
        state.accumulator = this.stepCalculation(
          state.pending,
          state.accumulator ?? this.currentValue(),
          this.currentValue(),
        );
        state.display = state.accumulator;
      }

      state.accumulator = this.currentValue();
      state.pending = operation;
      state.fresh = true;
      return;
    }

    if (action === 'equals' && state.pending) {
      const left = state.accumulator ?? 0;
      this.setDisplay(this.stepCalculation(state.pending, left, this.currentValue()));
      state.pending = null;
      state.accumulator = null;
    }
  }

  private enterSpecialKey(action: Action, source: PressSource): void {
    const state = this.state;

    if (action === 'x') {
      if (source === 'replay') {
        state.display = state.inputValue;
        state.fresh = false;
      } else {
        state.inputX = true;
      }
      return;
    }

    if (action === 'pi' || action === 'negate') {
      this.applyFunction(action);
      return;
    }

    const normalFunctions = ['square', 'sqrt', 'sin', 'cos', 'tan'];
    if (!normalFunctions.includes(action)) return;

    const inverseFunctions: Partial<Record<Action, InverseFunction>> = {
      sin: 'asin',
      cos: 'acos',
      tan: 'atan',
    };
    let selected: Action | InverseFunction = action;
    if (state.shift) {
      if (action === 'square') selected = 'sqrt';
      else if (action === 'sqrt') selected = 'square';
      else selected = inverseFunctions[action] ?? action;
    }

    this.applyFunction(selected);
    state.shift = false;
  }

  private applyFunction(operation: Action | InverseFunction): void {
    const value = this.currentValue();
    const radians = this.state.angle === 'DEG' ? (value * Math.PI) / 180 : value;
    const degrees = (result: number): number => this.state.angle === 'DEG'
      ? (result * 180) / Math.PI
      : result;

    switch (operation) {
      case 'square':
        this.setDisplay(value * value);
        break;
      case 'sqrt':
        this.setDisplay(Math.sqrt(value));
        break;
      case 'sin':
        this.setDisplay(Math.sin(radians));
        break;
      case 'cos':
        this.setDisplay(Math.cos(radians));
        break;
      case 'tan':
        this.setDisplay(Math.tan(radians));
        break;
      case 'asin':
        this.setDisplay(degrees(Math.asin(value)));
        break;
      case 'acos':
        this.setDisplay(degrees(Math.acos(value)));
        break;
      case 'atan':
        this.setDisplay(degrees(Math.atan(value)));
        break;
      case 'pi':
        this.setDisplay(Math.PI);
        break;
      case 'negate':
        this.setDisplay(-value);
        break;
    }
  }
}
