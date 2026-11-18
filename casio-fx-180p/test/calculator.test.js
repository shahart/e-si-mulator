import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { File } from 'node:buffer';
import test from 'node:test';
import { Calculator } from '../dist/calculator.js';
import { readProgramFile } from '../dist/program-file.js';

async function readDemoProgram() {
  const text = await readFile(new URL('../demo-program.json', import.meta.url), 'utf8');
  return JSON.parse(text);
}

test('records and replays the octahedron example with a new input', async () => {
  const demo = await readDemoProgram();
  const calculator = new Calculator();

  calculator.press('mode');
  calculator.press('0');
  for (const step of demo.steps) calculator.press(step);
  calculator.press('mode');

  calculator.press('1');
  calculator.press('0');
  calculator.press('runP1');

  assert.equal(calculator.state.programs.P1.length, 8);
  assert.ok(Math.abs(Number(calculator.state.display) - 300 * Math.sqrt(2)) < 1e-9);
});

test('program memory is shared by P1 and P2 and stops at 38 steps', () => {
  const calculator = new Calculator();
  calculator.press('mode');
  calculator.press('0');

  for (let step = 0; step < 38; step += 1) calculator.press('1');
  assert.equal(calculator.totalSteps, 38);

  calculator.press('runP2');
  calculator.press('2');

  assert.equal(calculator.totalSteps, 38);
  assert.equal(calculator.state.error, 'MEM FULL');
  assert.equal(calculator.state.programs.P2.length, 0);
});

test('loads the external demo JSON file and validates its steps', async () => {
  const text = await readFile(new URL('../demo-program.json', import.meta.url), 'utf8');
  const file = new File([text], 'demo-program.json', { type: 'application/json' });

  const program = await readProgramFile(file);

  assert.equal(program.name, 'Octahedron surface area');
  assert.deepEqual(program.steps, [
    '3', 'multiply', '2', 'sqrt', 'multiply', 'x', 'square', 'equals',
  ]);
});

test('rejects uploaded programs with unsupported key steps', async () => {
  const file = new File(
    [JSON.stringify({ name: 'Bad program', steps: ['delete everything'] })],
    'bad-program.json',
  );

  await assert.rejects(readProgramFile(file), /cannot record/);
});

test('rejects program files larger than the import limit', async () => {
  const file = new File([' '.repeat(20_001)], 'oversized.json');

  await assert.rejects(readProgramFile(file), /too large/);
});
