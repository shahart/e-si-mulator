import { createGraphRenderer } from './graph.js';
import { evaluateExpression, formatNumber, runProgram } from './machine.js';
import {
  MEMORY_BYTES,
  memoryUsed,
  readPrograms,
  validatePrograms,
  type Program,
} from './programs.js';

let programs: Program[] = [{
  name: 'SQUARE',
  source: ['?"X="→A', 'A^2→B', 'Disp B'],
}];
let selected = 0;
let mode = 'RUN';
let calculatorExpression = '';
let calculationComplete = false;

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
};

const display = $('display');
const programList = $('program-list');
const editor = $('program-source') as HTMLTextAreaElement;
const graph = createGraphRenderer($('graph-canvas') as HTMLCanvasElement);

function showDisplay(text: string): void {
  const line = document.createElement('span');
  line.textContent = text;
  display.replaceChildren(line);
}

function setStatus(message: string, error = false): void {
  const status = $('file-status');
  status.textContent = message;
  status.classList.toggle('error', error);
}

function enterDigit(digit: string): void {
  if (calculationComplete) calculatorExpression = '';
  calculationComplete = false;
  calculatorExpression += digit;
  showDisplay(calculatorExpression);
}

function enterOperator(operator: string): void {
  calculationComplete = false;
  if (!calculatorExpression) {
    if (operator === '-') calculatorExpression = operator;
    else return;
  } else if (/[+−×÷^]$/.test(calculatorExpression)) {
    calculatorExpression = calculatorExpression.slice(0, -1) + operator;
  } else {
    calculatorExpression += operator;
  }
  showDisplay(calculatorExpression);
}

function calculate(): void {
  if (!calculatorExpression) {
    run();
    return;
  }

  try {
    const answer = evaluateExpression(calculatorExpression);
    calculatorExpression = formatNumber(answer);
    calculationComplete = true;
    showDisplay(calculatorExpression);
    setStatus(`ANS = ${calculatorExpression}`);
  } catch (error) {
    showDisplay('Math ERROR');
    setStatus(error instanceof Error ? error.message : 'Math ERROR', true);
    calculatorExpression = '';
    calculationComplete = true;
  }
}

function applyUnary(operation: 'inverse' | 'square' | 'sqrt'): void {
  if (!calculatorExpression) return;

  try {
    const expression = calculatorExpression;
    const input = evaluateExpression(expression);
    const answer = operation === 'inverse'
      ? 1 / input
      : operation === 'square'
        ? input ** 2
        : Math.sqrt(input);
    calculatorExpression = formatNumber(answer);
    calculationComplete = true;
    showDisplay(calculatorExpression);
    setStatus(`ANS = ${calculatorExpression}`);
  } catch (error) {
    showDisplay('Math ERROR');
    setStatus(error instanceof Error ? error.message : 'Math ERROR', true);
    calculatorExpression = '';
    calculationComplete = true;
  }
}

function clearCalculator(): void {
  calculatorExpression = '';
  calculationComplete = false;
  showDisplay('Ready');
}

function render(): void {
  $('mode-indicator').textContent = mode;
  $('program-count').textContent = `${programs.length} PROGRAM${programs.length === 1 ? '' : 'S'}`;
  $('memory-count').textContent = `${memoryUsed(programs).toLocaleString()} / ${MEMORY_BYTES.toLocaleString()} BYTES`;
  programList.replaceChildren();

  programs.forEach((program, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `program-entry${index === selected ? ' active' : ''}`;
    button.textContent = `${program.name}  ·  ${program.source.length} lines`;
    button.setAttribute('aria-pressed', String(index === selected));
    button.addEventListener('click', () => {
      saveEditor();
      selected = index;
      editor.value = programs[index].source.join('\n');
      render();
    });
    programList.append(button);
  });

  if (programs[selected]) {
    editor.value = programs[selected].source.join('\n');
    ($('program-name') as HTMLInputElement).value = programs[selected].name;
  }
}

function saveEditor(): void {
  if (!programs[selected]) return;

  programs[selected] = {
    ...programs[selected],
    source: editor.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  };
}

function importPrograms(imported: Program[], label: string): void {
  const importedNames = new Set(imported.map((program) => program.name.toUpperCase()));
  const merged = [
    ...programs.filter((program) => !importedNames.has(program.name.toUpperCase())),
    ...imported,
  ];

  if (memoryUsed(merged) > MEMORY_BYTES) {
    throw new Error('Import would exceed the remaining 24 KiB memory.');
  }

  programs = merged;
  selected = programs.findIndex(
    (program) => program.name.toUpperCase() === imported[0].name.toUpperCase(),
  );
  mode = 'PRGM';
  render();
  setStatus(
    `Imported ${imported.length} program${imported.length === 1 ? '' : 's'} from ${label}. `
    + 'Programs with matching names were replaced.',
  );
}

function run(): void {
  saveEditor();
  graph.clear();

  const name = programs[selected]?.name ?? 'PROGRAM';
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] Run ${name}: start`);

  try {
    const result = runProgram(programs[selected], programs, (label) => {
      return Number(window.prompt(label) ?? 0);
    });

    graph.draw(result.graph);
    display.replaceChildren();
    const lines = result.lines.length ? result.lines : [result.error || 'Ready'];
    lines.slice(-5).forEach((line) => {
      const row = document.createElement('span');
      row.textContent = line;
      display.append(row);
    });

    if (result.error) {
      setStatus(result.error, true);
      return;
    }

    const plotCount = result.graph.filter((action) => action.kind === 'plot' && action.on).length;
    if (plotCount) {
      setStatus(`Ran ${name}. ${plotCount} point${plotCount === 1 ? '' : 's'} plotted.`);
    } else {
      const count = result.lines.length;
      setStatus(`Ran ${name}. ${count} output line${count === 1 ? '' : 's'}.`);
    }
  } finally {
    const stoppedAt = new Date();
    console.log(
      `[${stoppedAt.toISOString()}] Run ${name}: stop (${stoppedAt.getTime() - startedAt.getTime()} ms)`,
    );
  }
}

$('program-source').addEventListener('input', saveEditor);
$('run-program').addEventListener('click', run);
$('clear-graph').addEventListener('click', () => {
  graph.clear();
  setStatus('Graph cleared.');
});

$('save-program').addEventListener('click', () => {
  saveEditor();
  render();
  setStatus(`Saved ${programs[selected].name}.`);
});

$('new-program').addEventListener('click', () => {
  saveEditor();
  let name = `PRG${programs.length + 1}`;
  while (programs.some((program) => program.name === name)) {
    name = `P${Math.floor(Math.random() * 9999)}`;
  }

  programs.push({ name, source: ['?→A', 'Disp A'] });
  selected = programs.length - 1;
  mode = 'PRGM';
  render();
  setStatus('New program added. Rename it in the Program name field.');
  ($('program-name') as HTMLInputElement).value = name;
});

$('program-name').addEventListener('change', () => {
  const nameField = $('program-name') as HTMLInputElement;
  const name = nameField.value.trim().toUpperCase();
  const isValid = /^[A-Z][A-Z0-9_]{0,7}$/.test(name);
  const isDuplicate = programs.some((program, index) => index !== selected && program.name === name);

  if (!isValid || isDuplicate) {
    setStatus('Use a unique name of 1–8 letters, digits, or underscores, starting with a letter.', true);
    nameField.value = programs[selected].name;
    return;
  }

  programs[selected].name = name;
  nameField.value = name;
  render();
});

$('mode-button').addEventListener('click', () => {
  mode = mode === 'RUN' ? 'PRGM' : 'RUN';
  render();
  setStatus(mode === 'PRGM' ? 'Program editor ready.' : 'Run mode ready.');
});

async function loadExample(filename: string, description: string): Promise<void> {
  try {
    const response = await fetch(`./${filename}`);
    if (!response.ok) throw new Error(`Could not load example (HTTP ${response.status}).`);
    const data: unknown = await response.json();
    importPrograms(validatePrograms(data), filename);
    setStatus(`Loaded the ${description} example. Press Run program to draw it.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not load example.', true);
  }
}

$('load-example').addEventListener('click', () => {
  void loadExample('mandelbrot.json', 'Mandelbrot');
});
$('load-sine').addEventListener('click', () => {
  void loadExample('sine.json', 'sine wave');
});

$('upload').addEventListener('change', async (event) => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    importPrograms(await readPrograms(file), file.name);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Import failed.', true);
  } finally {
    input.value = '';
  }
});

$('export-programs').addEventListener('click', () => {
  saveEditor();
  const contents = JSON.stringify({ version: 1, programs }, null, 2);
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fx-9700ge-programs.json';
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${programs.length} program${programs.length === 1 ? '' : 's'}.`);
});

$('delete-program').addEventListener('click', () => {
  if (programs.length < 2) {
    setStatus('Keep at least one program in memory.', true);
    return;
  }

  const [deleted] = programs.splice(selected, 1);
  selected = Math.min(selected, programs.length - 1);
  render();
  setStatus(`Deleted ${deleted.name}.`);
});

const keypadRows = [
  ['MENU', 'EXIT'],
  ['x⁻¹', 'x²', '^', '√'],
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', 'EXE', '+'],
];

const keygrid = $('keypad');
keypadRows.forEach((row, rowIndex) => {
  const keyRow = document.createElement('div');
  keyRow.className = 'key-row';

  row.forEach((label) => {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = `key${rowIndex < 2 ? ' function-key' : ''}${label === 'EXE' ? ' execute' : ''}`;
    key.textContent = label;
    key.addEventListener('click', () => {
      if (/^[0-9.]$/.test(label)) {
        enterDigit(label);
      } else if (['+', '−', '×', '÷', '^'].includes(label)) {
        enterOperator(label);
      } else if (label === 'EXE') {
        calculate();
      } else if (label === 'x⁻¹') {
        applyUnary('inverse');
      } else if (label === 'x²') {
        applyUnary('square');
      } else if (label === '√') {
        applyUnary('sqrt');
      } else if (label === 'MENU') {
        mode = mode === 'RUN' ? 'PRGM' : 'RUN';
        render();
      } else if (label === 'EXIT') {
        clearCalculator();
      } else {
        setStatus(`${label} key selected. Enter full commands in the program editor.`);
      }
    });
    keyRow.append(key);
  });

  while (keyRow.childElementCount < 4) {
    const spacer = document.createElement('span');
    spacer.className = 'key-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    keyRow.append(spacer);
  }

  keygrid.append(keyRow);
});

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLElement && event.target.isContentEditable) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  if (/^[0-9.]$/.test(event.key)) enterDigit(event.key);
  else if (['+', '-', '*', '/'].includes(event.key)) {
    const operators: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    enterOperator(operators[event.key]);
  } else if (event.key === 'Enter' || event.key === '=') {
    event.preventDefault();
    calculate();
  } else if (event.key === 'Escape') {
    clearCalculator();
  } else if (event.key === 'Backspace' && calculatorExpression) {
    calculatorExpression = calculatorExpression.slice(0, -1);
    calculationComplete = false;
    showDisplay(calculatorExpression || 'Ready');
  }
});

render();
