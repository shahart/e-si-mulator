import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { File } from 'node:buffer';
import test from 'node:test';
import { runProgram } from '../dist/machine.js';
import { readPrograms, validatePrograms, MEMORY_BYTES, memoryUsed } from '../dist/programs.js';

test('runs arithmetic, variables, and prompted input', () => {
  const result = runProgram({ name: 'SQUARE', source: ['?"X="→A', 'A^2→B', 'Disp B'] }, [], () => 7);
  assert.deepEqual(result.lines, ['49']);
  assert.equal(result.error, '');
});

test('follows conditional jumps and detects unknown labels', () => {
  const result = runProgram({ name: 'BRANCH', source: ['2→A', 'A>1⇒Goto 2', 'Disp 0', 'Lbl 2', 'Disp A'] }, []);
  assert.deepEqual(result.lines, ['2']);
  assert.equal(runProgram({ name: 'BAD', source: ['Goto 9'] }, []).error, 'Label 9 not found.');
});

test('imports single and collection JSON formats', async () => {
  const file = new File([JSON.stringify({ version: 1, programs: [{ name: 'TEST', source: ['Disp 42'] }] })], 'program.json');
  assert.equal((await readPrograms(file))[0].name, 'TEST');
  assert.equal(validatePrograms({ name: 'ONE', source: ['Disp 1'] }).length, 1);
  assert.throws(() => validatePrograms({ version: 2, name: 'OLD', source: ['Disp 0'] }), /version/);
});

test('rejects duplicate names and oversize files and measures the memory budget', async () => {
  assert.throws(() => validatePrograms({ programs: [{ name: 'A', source: ['Disp 1'] }, { name: 'a', source: ['Disp 2'] }] }), /unique/);
  const large = new File([' '.repeat(100_001)], 'big.json');
  await assert.rejects(readPrograms(large), /too large/);
  assert.ok(memoryUsed([{ name: 'A', source: ['Disp 1'] }]) < MEMORY_BYTES);
});

test('demo JSON contains valid programs', async () => {
  const data = JSON.parse(await readFile(new URL('../demo-program.json', import.meta.url), 'utf8'));
  assert.equal(validatePrograms(data).length, 2);
});
