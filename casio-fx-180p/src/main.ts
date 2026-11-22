import { Calculator } from './calculator.js';
import { keys } from './keys.js';
import { readProgramFile } from './program-file.js';
import type { Action, KeyAction, ProgramBank, ProgramStep } from './types.js';

const calculator = new Calculator();
const keyLabels: Record<string, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  square: 'x²',
  sqrt: '√',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  x: 'x',
  equals: '=',
  pi: 'π',
  negate: '(-)',
  decimal: '.',
  execute: 'EXE',
};

const demoSteps: ProgramStep[] = [
  '3', 'multiply', '2', 'sqrt', 'multiply', 'x', 'square', 'equals',
];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as T;
}

function format(value: number | string): string {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '0.';

  const rounded = Number(value.toPrecision(11));
  const formatted = rounded.toString();
  return formatted.length > 13
    ? value.toExponential(5)
    : formatted + (Number.isInteger(value) ? '.' : '');
}

function renderProgram(): void {
  const { state } = calculator;
  const program = state.programs[state.bank];
  const list = byId<HTMLDivElement>('program-list');

  if (program.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        No program stored in ${state.bank}.<br>
        <span>Press <kbd>MODE</kbd> then <kbd>0</kbd> to record.</span>
      </div>`;
    return;
  }

  list.innerHTML = program
    .map((key, index) => {
      const number = String(index + 1).padStart(2, '0');
      const label = keyLabels[key] || key;
      const note = key === 'x' ? 'data input' : '';

      return `
        <div class="step">
          <span class="step-no">${number}</span>
          <span class="step-key">${label}</span>
          <span class="step-note">${note}</span>
        </div>`;
    })
    .join('');
}

function render(): void {
  const { state } = calculator;
  byId<HTMLOutputElement>('display').textContent = state.error || format(state.display);
  byId<HTMLSpanElement>('mode-indicator').textContent = state.mode;
  byId<HTMLSpanElement>('bank-indicator').textContent = state.bank;
  byId<HTMLSpanElement>('angle-indicator').textContent = state.angle;
  byId<HTMLSpanElement>('line-indicator').textContent = state.mode === 'LRN'
    ? String(state.programs[state.bank].length + 1).padStart(2, '0')
    : '';
  byId<HTMLSpanElement>('memory-count').textContent = `${calculator.totalSteps} / 38 STEPS`;
  const status = document.getElementById('execution-status');
  if (status) status.textContent = state.execution === 'input' ? 'INPUT — enter value, press EXE'
    : state.execution === 'halt' ? 'PAUSED — press EXE to continue'
      : state.execution === 'output' ? 'OUTPUT — press EXE to continue' : state.execution.toUpperCase();
  const memory = document.getElementById('register-view');
  if (memory) memory.textContent = `M: ${state.m ?? '—'}   K1–K6: ${state.memories.map((v) => v ?? '—').join(' · ')}`;

  document
    .querySelector('[data-action="shift"]')
    ?.classList.toggle('pressed', state.shift);

  renderProgram();

  document.querySelectorAll<HTMLButtonElement>('.bank').forEach((button) => {
    const selected = button.dataset.bank === state.bank;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
}

function renderKeypad(): void {
  const board = byId<HTMLDivElement>('keypad');

  keys.forEach((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `key ${key.cls || ''} ${key.action === '0' ? 'wide' : ''}`;
    button.dataset.action = key.action;
    button.innerHTML = `${key.sub ? `<small>${key.sub}</small>` : ''}${key.label}`;
    button.setAttribute(
      'aria-label',
      key.sub ? `${key.label}, secondary ${key.sub}` : key.label,
    );
    button.addEventListener('click', () => {
      pressKey(key.action);
    });
    board.append(button);
  });
}

function pressKey(action: KeyAction): void {
  calculator.press(action);
  render();

  if (calculator.state.error === 'MEM FULL') {
    window.alert(
      'The fx-180P has 38 program steps total across P1 and P2. Clear a program before adding more steps.',
    );
  }
}

function setFileStatus(message: string, isError = false): void {
  const status = byId<HTMLParagraphElement>('file-status');
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'success';
}

async function importProgramFile(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  try {
    const program = await readProgramFile(file);
    if (program.steps.length > calculator.availableSteps) {
      const available = calculator.availableSteps;
      const message = `This program has ${program.steps.length} steps, but only ${available} are available.`;
      setFileStatus(message, true);
      window.alert(
        `This program needs ${program.steps.length} steps, but only ${available} of the fx-180P's 38 shared steps are available.`,
      );
      return;
    }

    const bank = calculator.state.bank;
    calculator.loadProgram(bank, program.steps);
    render();
    setFileStatus(`Loaded “${program.name}” into ${bank} (${program.steps.length} steps).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load this program file.';
    setFileStatus(message, true);
  }
}

function handleKeyboard(event: KeyboardEvent): void {
  const keyActions: Record<string, Action> = {
    Enter: 'equals',
    '=': 'equals',
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '.': 'decimal',
    Backspace: 'clear',
    Escape: 'clear',
  };
  const action = keyActions[event.key] ?? event.key.toLowerCase();
  const supported = /^[0-9]$/.test(action)
    || ['decimal', 'add', 'subtract', 'multiply', 'divide', 'equals'].includes(action);

  if (!supported) return;

  event.preventDefault();
  pressKey(action as Action);
}

renderKeypad();

document.querySelectorAll<HTMLButtonElement>('.bank').forEach((button) => {
  button.addEventListener('click', () => {
    const bank = button.dataset.bank;
    if (bank !== 'P1' && bank !== 'P2') return;
    calculator.selectBank(bank as ProgramBank);
    render();
  });
});

byId<HTMLButtonElement>('clear-program').addEventListener('click', () => {
  calculator.clearProgram();
  render();
});

byId<HTMLInputElement>('program-file').addEventListener('change', (event) => {
  void importProgramFile(event);
});

byId<HTMLButtonElement>('load-demo').addEventListener('click', () => {
  calculator.loadProgram('P1', demoSteps);
  calculator.state.display = 10;
  calculator.state.fresh = false;
  render();
});

document.addEventListener('keydown', handleKeyboard);
render();
