export interface Program {
  name: string;
  source: string[];
}

export const MEMORY_BYTES = 24 * 1024;

const MAX_FILE_SIZE = 100_000;
const MAX_LINE_LENGTH = 160;
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,7}$/;

export function memoryUsed(programs: Program[]): number {
  return programs.reduce((total, program) => {
    const contents = program.name + program.source.join('\n');
    return total + new TextEncoder().encode(contents).length + 1;
  }, 0);
}

export function validatePrograms(value: unknown): Program[] {
  if (value === null || typeof value !== 'object') {
    throw new Error('JSON must contain a program or programs array.');
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(value) && record.version !== undefined && record.version !== 1) {
    throw new Error('Unsupported JSON program format version.');
  }

  const entries: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(record.programs) ? record.programs : [value];

  if (!entries.length) throw new Error('Add at least one program to the file.');

  const parsed = entries.map((entry): Program => {
    if (!isRecord(entry)) {
      throw new Error(invalidProgramMessage());
    }

    const lines = sourceLines(entry.source);
    if (typeof entry.name !== 'string' || !NAME.test(entry.name)
      || lines === null || !lines.length
      || !lines.every((line) => line.length <= MAX_LINE_LENGTH)) {
      throw new Error(invalidProgramMessage());
    }

    return {
      name: entry.name,
      source: lines.map((line) => line.trim()).filter(Boolean),
    };
  });

  if (parsed.some((program) => !program.source.length)) {
    throw new Error('Programs cannot have empty source.');
  }
  if (new Set(parsed.map((program) => program.name.toUpperCase())).size !== parsed.length) {
    throw new Error('Program names must be unique.');
  }
  if (memoryUsed(parsed) > MEMORY_BYTES) {
    throw new Error('Programs exceed the 24 KiB memory limit.');
  }

  return parsed;
}

export function programNameFromFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? 'PROGRAM';
  const stem = base.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_]/g, '');
  let name = stem.toUpperCase().slice(0, 8);
  if (!name) return 'PROGRAM';
  if (!/^[A-Z]/.test(name)) name = `P${name}`.slice(0, 8);
  return name;
}

export function parseProgramText(text: string, filename: string): Program {
  const source = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const [program] = validatePrograms([{
    name: programNameFromFilename(filename),
    source,
  }]);
  return program;
}

export async function readPrograms(file: File): Promise<Program[]> {
  if (file.size > MAX_FILE_SIZE) throw new Error('That program file is too large (100 KB maximum).');

  const text = await file.text();
  const trimmed = text.trim();
  if (/\.json$/i.test(file.name) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error('Could not parse this file as JSON.');
    }

    return validatePrograms(value);
  }

  return [parseProgramText(text, file.name)];
}

function sourceLines(value: unknown): string[] | null {
  if (typeof value === 'string') return value.split(/\r?\n/);
  if (Array.isArray(value)) return value;
  return null;
}

function invalidProgramMessage(): string {
  return `Each program needs a 1–8 character name and a non-empty source array of lines (up to ${MAX_LINE_LENGTH} characters each).`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
