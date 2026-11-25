import { readFile } from 'node:fs/promises';
import { File } from 'node:buffer';
import { expect, test } from 'vitest';
import { Calculator } from '../src/calculator.js';
import { readProgramFile } from '../src/program-file.js';

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

  expect(calculator.state.programs.P1.length).toBe(8);
  expect(Math.abs(Number(calculator.state.display) - 300 * Math.sqrt(2))).toBeLessThan(1e-9);
});

test('program memory is shared by P1 and P2 and stops at 38 steps', () => {
  const calculator = new Calculator();
  calculator.press('mode');
  calculator.press('0');

  for (let step = 0; step < 38; step += 1) calculator.press('1');
  expect(calculator.totalSteps).toBe(38);

  calculator.press('runP2');
  calculator.press('2');

  expect(calculator.totalSteps).toBe(38);
  expect(calculator.state.error).toBe('MEM FULL');
  expect(calculator.state.programs.P2.length).toBe(0);
});

test('loads the external demo JSON file and validates its steps', async () => {
  const text = await readFile(new URL('../demo-program.json', import.meta.url), 'utf8');
  const file = new File([text], 'demo-program.json', { type: 'application/json' });

  const program = await readProgramFile(file);

  expect(program.name).toBe('Octahedron surface area');
  expect(program.steps).toEqual([
    '3', 'multiply', '2', 'sqrt', 'multiply', 'x', 'square', 'equals',
  ]);
});

test('rejects uploaded programs with unsupported key steps', async () => {
  const file = new File(
    [JSON.stringify({ name: 'Bad program', steps: ['delete everything'] })],
    'bad-program.json',
  );

  await expect(readProgramFile(file)).rejects.toThrow(/cannot record: "delete everything" \(step 1\)/);
});

test('rejects program files larger than the import limit', async () => {
  const file = new File([' '.repeat(20_001)], 'oversized.json');

  await expect(readProgramFile(file)).rejects.toThrow(/too large/);
});

test('K IN and K OUT select and recall each constant register', () => {
  const calculator = new Calculator();
  calculator.press('4');
  calculator.press('2');
  calculator.press('kin');
  calculator.press('3');

  expect(calculator.state.memories[2]).toBe(42);
  calculator.press('clear');
  calculator.press('kout');
  calculator.press('3');
  expect(calculator.state.display).toBe(42);
});

test('M IN replaces independent memory and M READ recalls it', () => {
  const calculator = new Calculator();
  calculator.press('1');
  calculator.press('2');
  calculator.press('min');
  calculator.press('clear');
  calculator.press('9');
  calculator.press('min');
  expect(calculator.state.m).toBe(9);
  calculator.press('clear');
  calculator.press('mr');
  expect(calculator.state.display).toBe(9);
});

test('program input pauses for a value and resumes at EXE', () => {
  const calculator = new Calculator();
  calculator.loadProgram('P1', ['input', 'multiply', '2', 'equals']);
  calculator.press('runP1');
  expect(calculator.state.execution).toBe('input');
  calculator.press('4');
  calculator.press('execute');
  expect(calculator.state.display).toBe(8);
  expect(calculator.state.execution).toBe('finished');
});

test('K OUT displays and continues while HLT pauses until EXE', () => {
  const calculator = new Calculator();
  calculator.press('4');
  calculator.press('kin');
  calculator.press('2');
  calculator.loadProgram('P1', ['kout2', '7', 'halt', '9']);
  calculator.press('runP1');

  expect(calculator.state.display).toBe('7');
  expect(calculator.state.execution).toBe('halt');
  calculator.press('execute');
  expect(calculator.state.display).toBe('9');
  expect(calculator.state.execution).toBe('finished');
});

test('conditional return falls through when its condition is false', () => {
  const calculator = new Calculator();
  calculator.state.m = 5;
  calculator.press('6');
  calculator.loadProgram('P1', ['loopLessEqual', 'square']);
  calculator.press('runP1');
  expect(calculator.state.display).toBe(36);
  expect(calculator.state.execution).toBe('finished');
});

test('conditional and unconditional returns stop runaway programs at the instruction limit', () => {
  const calculator = new Calculator();
  calculator.state.m = 5;
  calculator.loadProgram('P1', ['1', 'square', 'loopLessEqual']);
  calculator.press('runP1');
  expect(calculator.state.execution).toBe('error');
  expect(calculator.state.error).toBe('PROGRAM LIMIT');

  calculator.loadProgram('P1', ['return']);
  calculator.press('runP1');
  expect(calculator.state.execution).toBe('error');
  expect(calculator.state.error).toBe('PROGRAM LIMIT');
});

test('program import accepts memory and control-flow commands', async () => {
  const steps = ['kin3', 'min', 'input', 'kout3', 'loopPositive', 'return', 'halt'];
  const file = new File([JSON.stringify({ name: 'Memory loop', steps })], 'memory-loop.json');
  const program = await readProgramFile(file);
  expect(program.steps).toEqual(steps);
});

test('multiplication and division take precedence over addition and subtraction', () => {
  const calculator = new Calculator();
  for (const key of ['2', 'add', '3', 'multiply', '4', 'equals']) calculator.press(key);
  expect(calculator.state.display).toBe(14);

  calculator.press('clear');
  for (const key of ['2', 'multiply', '3', 'add', '8', 'divide', '4', 'equals']) calculator.press(key);
  expect(calculator.state.display).toBe(8);
});

test('parentheses group arithmetic and can be used inside a recorded program', () => {
  const calculator = new Calculator();
  for (const key of ['2', 'multiply', 'leftParen', '3', 'add', '4', 'rightParen', 'equals']) calculator.press(key);
  expect(calculator.state.display).toBe(14);

  calculator.loadProgram('P1', ['leftParen', '2', 'add', '3', 'rightParen', 'multiply', '4', 'equals']);
  calculator.press('runP1');
  expect(calculator.state.display).toBe(20);
});

test('program import converts literal parenthesis keys to calculator steps', async () => {
  const file = new File([
    JSON.stringify({ name: 'Grouped expression', steps: ['2', 'multiply', '(', '3', 'add', '4', ')', 'equals'] }),
  ], 'grouped-expression.json');
  const program = await readProgramFile(file);
  expect(program.steps).toEqual(['2', 'multiply', 'leftParen', '3', 'add', '4', 'rightParen', 'equals']);
});
