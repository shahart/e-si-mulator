import type {
  Action,
  CalculatorMode,
  KeyAction,
  ProgramBank,
  ProgramCommand,
  ProgramStep,
} from './types.js';

type Operation = 'add' | 'subtract' | 'multiply' | 'divide';
type ExpressionOperator = Operation | '(';

export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'input'
  | 'output'
  | 'halt'
  | 'finished'
  | 'error';

const MAX_EXECUTION_STEPS = 10_000;

function isCommand(action: KeyAction): action is ProgramCommand {
  const isMemoryCommand = /^(kin|kout)[1-6]$/.test(action);
  const commands: ProgramCommand[] = [
    'min',
    'mr',
    'halt',
    'input',
    'return',
    'loopPositive',
    'loopLessEqual',
  ];

  return isMemoryCommand || commands.includes(action as ProgramCommand);
}

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
  inputValue: number;
  error: string;
  memories: Array<number | null>;
  m: number | null;
  execution: ExecutionStatus;
  pc: number;
  waitingForInput: boolean;
  sequence: 'kin' | 'kout' | null;
  expressionValues: number[];
  expressionOperators: ExpressionOperator[];
  awaitingOperand: boolean;
}

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
    inputValue: 0,
    error: '',
    memories: Array(6).fill(null),
    m: null,
    execution: 'idle',
    pc: 0,
    waitingForInput: false,
    sequence: null,
    expressionValues: [],
    expressionOperators: [],
    awaitingOperand: false,
  };

  get totalSteps(): number {
    return this.state.programs.P1.length + this.state.programs.P2.length;
  }

  get availableSteps(): number {
    const otherBank = this.state.bank === 'P1' ? 'P2' : 'P1';
    return 38 - this.state.programs[otherBank].length;
  }

  press(action: KeyAction): void {
    const state = this.state;
    state.error = '';

    if (state.sequence) {
      const sequence = state.sequence;
      state.sequence = null;

      if (/^[1-6]$/.test(action)) {
        this.press(`${sequence}${action}` as ProgramCommand);
        return;
      }

      this.press(action);
      return;
    }

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
      this.start(action === 'runP1' ? 'P1' : 'P2');
      return;
    }

    if (action === 'kin' || action === 'kout') {
      state.sequence = action;
      return;
    }

    if (action === 'execute') {
      this.executeKey();
      return;
    }

    if (state.mode === 'LRN') {
      this.recordStep(action);
      return;
    }

    if (action === 'clear') {
      this.clearEntry();
      return;
    }

    if (isCommand(action)) {
      this.executeCommandKey(action);
      return;
    }

    this.perform(action as Action);
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

  private executeKey(): void {
    const state = this.state;

    if (state.execution === 'input') {
      state.inputValue = this.value();
      state.awaitingOperand = false;
      state.waitingForInput = false;
      state.execution = 'running';
      this.resume();
      return;
    }

    if (state.execution === 'halt' || state.execution === 'output') {
      state.execution = 'running';
      this.resume();
    }
  }

  private recordStep(action: KeyAction): void {
    const state = this.state;

    if (this.totalSteps >= 38) {
      state.error = 'MEM FULL';
      return;
    }

    state.programs[state.bank].push(action as ProgramStep);
  }

  private clearEntry(): void {
    const state = this.state;
    state.display = '0';
    state.accumulator = null;
    state.pending = null;
    state.expressionValues = [];
    state.expressionOperators = [];
    state.awaitingOperand = false;
    state.fresh = true;
  }

  private executeCommandKey(command: ProgramCommand): void {
    const state = this.state;

    if (command === 'input') {
      state.execution = 'input';
      state.waitingForInput = true;
      state.display = '0';
      state.fresh = true;
      return;
    }

    if (command === 'halt') {
      state.execution = 'halt';
      state.fresh = true;
      return;
    }

    this.executeCommand(command);
  }

  private value(): number {
    return Number(this.state.display) || 0;
  }

  private start(bank: ProgramBank): void {
    const state = this.state;
    state.bank = bank;
    state.mode = 'RUN';
    state.inputValue = this.value();
    state.pc = 0;
    state.accumulator = null;
    state.pending = null;
    state.expressionValues = [];
    state.expressionOperators = [];
    state.awaitingOperand = false;
    state.fresh = true;
    state.execution = 'running';
    this.resume();
  }

  private resume(): void {
    const state = this.state;
    const program = state.programs[state.bank];
    let executedSteps = 0;

    while (
      state.pc < program.length
      && executedSteps++ < MAX_EXECUTION_STEPS
      && state.execution === 'running'
    ) {
      const step = program[state.pc++];

      if (step === 'x') {
        state.display = state.inputValue;
        state.fresh = false;
        state.awaitingOperand = false;
        continue;
      }

      if (step === 'input') {
        state.execution = 'input';
        state.waitingForInput = true;
        state.display = '0';
        state.fresh = true;
        return;
      }

      if (step === 'halt') {
        state.execution = 'halt';
        state.fresh = true;
        return;
      }

      if (step === 'return') {
        state.pc = 0;
        continue;
      }

      if (step === 'loopPositive') {
        if (this.value() > 0) state.pc = 0;
        continue;
      }

      if (step === 'loopLessEqual') {
        if (this.value() <= (state.m ?? 0)) state.pc = 0;
        continue;
      }

      if (isCommand(step)) {
        this.executeCommand(step);
        continue;
      }

      this.perform(step as Action);
    }

    if (state.execution !== 'running') return;

    if (executedSteps >= MAX_EXECUTION_STEPS && state.pc < program.length) {
      state.execution = 'error';
      state.error = 'PROGRAM LIMIT';
      return;
    }

    state.execution = 'finished';
  }

  private executeCommand(command: ProgramCommand): void {
    const state = this.state;

    if (command === 'min') {
      state.m = this.value();
      return;
    }

    if (command === 'mr') {
      this.set(state.m ?? 0);
      return;
    }

    const match = /^(kin|kout)([1-6])$/.exec(command);
    if (!match) return;

    const index = Number(match[2]) - 1;
    if (match[1] === 'kin') {
      state.memories[index] = this.value();
      return;
    }

    this.set(state.memories[index] ?? 0);
  }

  private set(value: number): void {
    this.state.display = Number.isFinite(value) ? value : 'Math Error';
    this.state.fresh = true;
    this.state.awaitingOperand = false;
  }

  private precedence(operator: Operation): number {
    return operator === 'add' || operator === 'subtract' ? 1 : 2;
  }

  private reduceExpression(): void {
    const state = this.state;
    const operator = state.expressionOperators.pop();
    if (!operator || operator === '(') return;

    const right = state.expressionValues.pop() ?? 0;
    const left = state.expressionValues.pop() ?? 0;
    let result: number;

    switch (operator) {
      case 'add':
        result = left + right;
        break;
      case 'subtract':
        result = left - right;
        break;
      case 'multiply':
        result = left * right;
        break;
      case 'divide':
        result = left / right;
        break;
    }

    state.expressionValues.push(result);
  }

  private perform(action: Action): void {
    const state = this.state;

    if (/^[0-9]$/.test(action)) {
      state.display = state.fresh
        ? action
        : state.display === '0'
          ? action
          : `${state.display}${action}`;
      state.fresh = false;
      state.awaitingOperand = false;
      return;
    }

    if (action === 'decimal') {
      if (state.fresh) {
        state.display = '0.';
      } else if (!String(state.display).includes('.')) {
        state.display = `${state.display}.`;
      }
      state.fresh = false;
      state.awaitingOperand = false;
      return;
    }

    if (action === 'leftParen') {
      if (state.awaitingOperand || state.fresh) {
        state.expressionOperators.push('(');
        state.display = '0';
        state.fresh = true;
        state.awaitingOperand = true;
      }
      return;
    }

    if (action === 'rightParen') {
      if (state.awaitingOperand || !state.expressionOperators.includes('(')) return;

      state.expressionValues.push(this.value());
      while (state.expressionOperators.at(-1) !== '(') {
        this.reduceExpression();
      }
      state.expressionOperators.pop();
      state.display = state.expressionValues.pop() ?? 0;
      state.fresh = true;
      state.awaitingOperand = false;
      return;
    }

    if (this.isOperation(action)) {
      this.enterOperation(action);
      return;
    }

    if (action === 'equals') {
      this.enterEquals();
      return;
    }

    const value = this.value();
    const radians = state.angle === 'DEG' ? (value * Math.PI) / 180 : value;

    if (action === 'x') return;
    if (action === 'square') this.set(value * value);
    else if (action === 'sqrt') this.set(Math.sqrt(value));
    else if (action === 'sin') this.set(Math.sin(radians));
    else if (action === 'cos') this.set(Math.cos(radians));
    else if (action === 'tan') this.set(Math.tan(radians));
    else if (action === 'pi') this.set(Math.PI);
    else if (action === 'negate') this.set(-value);
  }

  private isOperation(action: Action): action is Operation {
    return action === 'add'
      || action === 'subtract'
      || action === 'multiply'
      || action === 'divide';
  }

  private enterOperation(operation: Operation): void {
    const state = this.state;

    if (state.awaitingOperand) {
      const topOperator = state.expressionOperators.at(-1);
      if (topOperator && topOperator !== '(') {
        state.expressionOperators[state.expressionOperators.length - 1] = operation;
      }
      return;
    }

    state.expressionValues.push(this.value());
    while (
      state.expressionOperators.length > 0
      && state.expressionOperators.at(-1) !== '('
      && this.precedence(state.expressionOperators.at(-1) as Operation) >= this.precedence(operation)
    ) {
      this.reduceExpression();
    }

    state.expressionOperators.push(operation);
    state.awaitingOperand = true;
    state.fresh = true;
  }

  private enterEquals(): void {
    const state = this.state;

    if (state.expressionOperators.includes('(')) {
      state.error = 'PAREN ERROR';
      state.expressionValues = [];
      state.expressionOperators = [];
      return;
    }

    if (!state.awaitingOperand) state.expressionValues.push(this.value());
    while (state.expressionOperators.length > 0) this.reduceExpression();

    if (state.expressionValues.length > 0) {
      this.set(state.expressionValues.pop()!);
    }

    state.expressionValues = [];
    state.expressionOperators = [];
    state.awaitingOperand = false;
    state.pending = null;
    state.accumulator = null;
  }
}
