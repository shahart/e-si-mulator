import type { ImportedProgram, ProgramStep } from './types.js';

const MAX_FILE_SIZE = 20_000;

const importableSteps = new Set<ProgramStep>([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'decimal',
  'add',
  'subtract',
  'multiply',
  'divide',
  'equals',
  'square',
  'sqrt',
  'sin',
  'cos',
  'tan',
  'pi',
  'negate',
  'x',
  'min', 'mr', 'halt', 'input', 'return', 'loopPositive', 'loopLessEqual',
  'kin1','kin2','kin3','kin4','kin5','kin6',
  'kout1','kout2','kout3','kout4','kout5','kout6',
]);

export async function readProgramFile(file: File): Promise<ImportedProgram> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('That file is too large to be a calculator program.');
  }

  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Could not read that file as JSON.');
  }

  if (!isRecord(data) || !Array.isArray(data.steps) || data.steps.length === 0) {
    throw new Error('The file must contain a non-empty "steps" array.');
  }

  if (!data.steps.every(isProgramStep)) {
    throw new Error('The file contains a key that this emulator cannot record.');
  }

  const steps = data.steps as ProgramStep[];
  const name = typeof data.name === 'string' && data.name.trim()
    ? data.name.trim()
    : file.name;

  return { name, steps };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProgramStep(value: unknown): value is ProgramStep {
  return typeof value === 'string' && importableSteps.has(value as ProgramStep);
}
