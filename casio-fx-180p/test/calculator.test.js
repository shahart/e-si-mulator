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

  await assert.rejects(readProgramFile(file), /cannot record: "delete everything" \(step 1\)/);
});

test('rejects program files larger than the import limit', async () => {
  const file = new File([' '.repeat(20_001)], 'oversized.json');

  await assert.rejects(readProgramFile(file), /too large/);
});

test('K IN and K OUT select and recall each constant register', () => {
  const calculator = new Calculator();
  calculator.press('4');
  calculator.press('2');
  calculator.press('kin');
  calculator.press('3');

  assert.equal(calculator.state.memories[2], 42);
  calculator.press('clear');
  calculator.press('kout');
  calculator.press('3');
  assert.equal(calculator.state.display, 42);
});

test('M IN replaces independent memory and M READ recalls it', () => {
  const calculator = new Calculator();
  calculator.press('1');
  calculator.press('2');
  calculator.press('min');
  calculator.press('clear');
  calculator.press('9');
  calculator.press('min');
  assert.equal(calculator.state.m, 9);
  calculator.press('clear');
  calculator.press('mr');
  assert.equal(calculator.state.display, 9);
});

test('program input pauses for a value and resumes at EXE', () => {
  const calculator = new Calculator();
  calculator.loadProgram('P1', ['input', 'multiply', '2', 'equals']);
  calculator.press('runP1');
  assert.equal(calculator.state.execution, 'input');
  calculator.press('4');
  calculator.press('execute');
  assert.equal(calculator.state.display, 8);
  assert.equal(calculator.state.execution, 'finished');
});

test('K OUT displays and continues while HLT pauses until EXE', () => {
  const calculator = new Calculator();
  calculator.press('4');
  calculator.press('kin');
  calculator.press('2');
  calculator.loadProgram('P1', ['kout2', '7', 'halt', '9']);
  calculator.press('runP1');

  assert.equal(calculator.state.display, '7');
  assert.equal(calculator.state.execution, 'halt');
  calculator.press('execute');
  assert.equal(calculator.state.display, '9');
  assert.equal(calculator.state.execution, 'finished');
});

test('conditional return falls through when its condition is false', () => {
  const calculator = new Calculator();
  calculator.state.m = 5;
  calculator.press('6');
  calculator.loadProgram('P1', ['loopLessEqual', 'square']);
  calculator.press('runP1');
  assert.equal(calculator.state.display, 36);
  assert.equal(calculator.state.execution, 'finished');
});

test('conditional and unconditional returns stop runaway programs at the instruction limit', () => {
  const calculator = new Calculator();
  calculator.state.m = 5;
  calculator.loadProgram('P1', ['1', 'square', 'loopLessEqual']);
  calculator.press('runP1');
  assert.equal(calculator.state.execution, 'error');
  assert.equal(calculator.state.error, 'PROGRAM LIMIT');

  calculator.loadProgram('P1', ['return']);
  calculator.press('runP1');
  assert.equal(calculator.state.execution, 'error');
  assert.equal(calculator.state.error, 'PROGRAM LIMIT');
});

test('program import accepts memory and control-flow commands', async () => {
  const steps = ['kin3', 'min', 'input', 'kout3', 'loopPositive', 'return', 'halt'];
  const file = new File([JSON.stringify({ name: 'Memory loop', steps })], 'memory-loop.json');
  const program = await readProgramFile(file);
  assert.deepEqual(program.steps, steps);
});

test('multiplication and division take precedence over addition and subtraction', () => {
  const calculator = new Calculator();
  for (const key of ['2', 'add', '3', 'multiply', '4', 'equals']) calculator.press(key);
  assert.equal(calculator.state.display, 14);

  calculator.press('clear');
  for (const key of ['2', 'multiply', '3', 'add', '8', 'divide', '4', 'equals']) calculator.press(key);
  assert.equal(calculator.state.display, 8);
});

test('parentheses group arithmetic and can be used inside a recorded program', () => {
  const calculator = new Calculator();
  for (const key of ['2', 'multiply', 'leftParen', '3', 'add', '4', 'rightParen', 'equals']) calculator.press(key);
  assert.equal(calculator.state.display, 14);

  calculator.loadProgram('P1', ['leftParen', '2', 'add', '3', 'rightParen', 'multiply', '4', 'equals']);
  calculator.press('runP1');
  assert.equal(calculator.state.display, 20);
});

test('program import converts literal parenthesis keys to calculator steps', async () => {
  const file = new File([
    JSON.stringify({ name: 'Grouped expression', steps: ['2', 'multiply', '(', '3', 'add', '4', ')', 'equals'] }),
  ], 'grouped-expression.json');
  const program = await readProgramFile(file);
  assert.deepEqual(program.steps, ['2', 'multiply', 'leftParen', '3', 'add', '4', 'rightParen', 'equals']);
});
