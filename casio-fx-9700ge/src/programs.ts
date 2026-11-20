export interface Program {
  name: string;
  source: string[];
}

export const MEMORY_BYTES = 24 * 1024;

const MAX_FILE_SIZE = 100_000;
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,7}$/;

export function memoryUsed(programs: Program[]): number {
  return programs.reduce((total, program) => {
    const contents = program.name + program.source.join('\n');
    return total + new TextEncoder().encode(contents).length + 1;
  }, 0);
}

export function validatePrograms(value: unknown): Program[] {
  if (!isRecord(value)) throw new Error('JSON must contain a program or programs array.');
  if (value.version !== undefined && value.version !== 1) {
    throw new Error('Unsupported JSON program format version.');
  }

  const entries = Array.isArray(value.programs) ? value.programs : [value];
  if (!entries.length) throw new Error('Add at least one program to the file.');

  const parsed = entries.map((entry): Program => {
    if (!isRecord(entry)) {
      throw new Error('Each program needs a 1–8 character name and a non-empty source array of lines (up to 160 characters each).');
    }
    if (typeof entry.name !== 'string' || !NAME.test(entry.name)
      || !Array.isArray(entry.source) || !entry.source.length
      || !entry.source.every((line) => typeof line === 'string' && line.length <= 160)) {
      throw new Error('Each program needs a 1–8 character name and a non-empty source array of lines (up to 160 characters each).');
    }

    return {
      name: entry.name,
      source: entry.source.map((line) => line.trim()).filter(Boolean),
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

export async function readPrograms(file: File): Promise<Program[]> {
  if (file.size > MAX_FILE_SIZE) throw new Error('That JSON file is too large (100 KB maximum).');

  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error('Could not parse this file as JSON.');
  }

  return validatePrograms(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
