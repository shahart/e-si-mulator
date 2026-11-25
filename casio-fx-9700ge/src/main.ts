import { createGraphRenderer } from './graph.js';
import {
  functionExpression,
  keyActionFor,
  keypadRows,
  type CalculatorFunction,
  type KeyAction,
} from './keypad.js';
import { evaluateExpression, formatNumber, runProgram } from './machine.js';
import {
  MEMORY_BYTES,
  memoryUsed,
  readPrograms,
  sourceLinks,
  validatePrograms,
  type Program,
} from './programs.js';

let programs: Program[] = [];
let selected = 0;
let mode = 'RUN';
let calculatorExpression = '';
let calculationComplete = false;
let shiftActive = false;
let calculatorMemory = 0;

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
};

const display = $('display');
const programList = $('program-list');
const editor = $('program-source') as HTMLTextAreaElement;
const graph = createGraphRenderer($('graph-canvas') as HTMLCanvasElement);
const keygrid = $('keypad');
const shiftIndicator = $('shift-indicator');
const memoryIndicator = $('memory-indicator');

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

async function readProgramFile(filename: string): Promise<Program[]> {
  const response = await fetch(`./${filename}`);
  if (!response.ok) throw new Error(`Could not load ${filename} (HTTP ${response.status}).`);
  return validatePrograms(await response.json());
}

const sourceOverlay = $('source-links');

function syncSourceOverlay(): void {
  const scrollbarWidth = Math.max(0, editor.offsetWidth - editor.clientWidth - 2);
  sourceOverlay.style.paddingRight = `${10 + scrollbarWidth}px`;
  sourceOverlay.scrollTop = editor.scrollTop;
}

function renderSourceLinks(): void {
  const source = editor.value;
  sourceOverlay.replaceChildren();

  let lastIndex = 0;
  for (const link of sourceLinks(source)) {
    sourceOverlay.append(document.createTextNode(source.slice(lastIndex, link.start)));

    const anchor = document.createElement('a');
    anchor.href = link.url;
    anchor.textContent = link.url;
    anchor.title = 'Open link in a new tab';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.tabIndex = -1;
    sourceOverlay.append(anchor);

    lastIndex = link.end;
  }
  sourceOverlay.append(document.createTextNode(source.slice(lastIndex)));
  syncSourceOverlay();
}

function enterValue(value: string): void {
  if (calculationComplete) calculatorExpression = '';
  calculationComplete = false;
  calculatorExpression += value;
  showDisplay(calculatorExpression);
}

function enterDigit(digit: string): void {
  enterValue(digit);
}

function enterPi(): void {
  enterValue('π');
}

function enterNegativeSign(): void {
  if (!calculatorExpression || /[+−×÷^(]$/.test(calculatorExpression)) {
    enterValue('-');
    return;
  }

  calculatorExpression = `-(${calculatorExpression})`;
  calculationComplete = false;
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

function applyFunction(name: CalculatorFunction): void {
  if (!calculatorExpression) return;

  try {
    const answer = evaluateExpression(functionExpression(name, calculatorExpression));
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

function clearAll(): void {
  clearCalculator();
  setStatus('All clear. M register kept.');
}

function setShift(active: boolean): void {
  shiftActive = active;
  shiftIndicator.hidden = !active;
  const shiftKey = keygrid.querySelector<HTMLButtonElement>('[data-action="shift"]');
  shiftKey?.classList.toggle('pressed', active);
  shiftKey?.setAttribute('aria-pressed', String(active));
}

function toggleMode(): void {
  mode = mode === 'RUN' ? 'PRGM' : 'RUN';
  render();
  setStatus(mode === 'PRGM' ? 'Program editor ready.' : 'Run mode ready.');
}

function updateMemoryIndicator(): void {
  memoryIndicator.textContent = `M ${formatNumber(calculatorMemory)}`;
}

function storeMemory(): void {
  try {
    const value = calculatorExpression ? evaluateExpression(calculatorExpression) : 0;
    if (!Number.isFinite(value)) throw new Error('M cannot store a non-finite value.');
    calculatorMemory = value;
    updateMemoryIndicator();
    setStatus(`M in: ${formatNumber(calculatorMemory)}`);
  } catch (error) {
    showDisplay('Math ERROR');
    setStatus(error instanceof Error ? error.message : 'Math ERROR', true);
    calculatorExpression = '';
    calculationComplete = true;
  }
}

function readMemory(): void {
  if (calculationComplete) calculatorExpression = '';
  calculationComplete = false;
  calculatorExpression += formatNumber(calculatorMemory);
  showDisplay(calculatorExpression);
  setStatus(`M read: ${formatNumber(calculatorMemory)}`);
}

function dispatchKey(action: KeyAction): void {
  switch (action.kind) {
    case 'digit': enterDigit(action.value); break;
    case 'operator': enterOperator(action.value); break;
    case 'function': applyFunction(action.value); break;
    case 'execute': calculate(); break;
    case 'memoryStore': storeMemory(); break;
    case 'memoryRead': readMemory(); break;
    case 'clear': clearCalculator(); break;
    case 'clearAll': clearAll(); break;
    case 'constant': enterPi(); break;
    case 'negative': enterNegativeSign(); break;
    case 'mode': toggleMode(); break;
    case 'shift': setShift(true); break;
  }
}

function render(): void {
  $('mode-indicator').textContent = mode;
  $('program-count').textContent = `${programs.length} PROGRAM${programs.length === 1 ? '' : 'S'}`;
  updateMemoryIndicator();
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

  renderSourceLinks();
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
    }, { M: calculatorMemory });

    if (Number.isFinite(result.variables.M)) {
      calculatorMemory = result.variables.M;
      updateMemoryIndicator();
    }

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

$('program-source').addEventListener('input', () => {
  saveEditor();
  renderSourceLinks();
});
editor.addEventListener('scroll', syncSourceOverlay);
new ResizeObserver(syncSourceOverlay).observe(editor);
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

$('mode-button').addEventListener('click', toggleMode);

async function loadExample(filename: string, description: string): Promise<void> {
  try {
    importPrograms(await readProgramFile(filename), filename);
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

keypadRows.forEach((row, rowIndex) => {
  const keyRow = document.createElement('div');
  keyRow.className = 'key-row';

  row.forEach((definition) => {
    const key = document.createElement('button');
    key.type = 'button';
    key.dataset.action = definition.action.kind;
    key.className = `key${rowIndex < 4 ? ' function-key' : ''}${definition.cls ? ` ${definition.cls}` : ''}`;

    if (definition.sub) {
      const subLabel = document.createElement('small');
      subLabel.textContent = definition.sub;
      key.append(subLabel, document.createTextNode(definition.label));
      key.setAttribute('aria-label', `${definition.label}, secondary ${definition.sub}`);
    } else {
      key.textContent = definition.label;
      key.setAttribute('aria-label', definition.label);
    }

    if (definition.cls === 'shift') key.setAttribute('aria-pressed', 'false');

    key.addEventListener('click', () => {
      if (definition.action.kind === 'shift') {
        setShift(!shiftActive);
        setStatus(shiftActive
          ? 'SHIFT on: the next key uses its secondary function.'
          : 'SHIFT off.');
        return;
      }

      const action = keyActionFor(definition, shiftActive);
      setShift(false);
      dispatchKey(action);
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

async function loadDefaultProgram(): Promise<void> {
  try {
    programs = await readProgramFile('mandelbrot.json');
  } catch (error) {
    programs = [{ name: 'PROGRAM1', source: ['Disp 0'] }];
    setStatus(error instanceof Error ? error.message : 'Could not load the default program.', true);
  }
}

await loadDefaultProgram();
render();
run();
