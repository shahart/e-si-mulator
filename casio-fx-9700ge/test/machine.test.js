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

test('seeds variable M from the calculator register', () => {
  const result = runProgram(
    { name: 'MEMORY', source: ['M+1→M', 'Disp M'] },
    [],
    () => 0,
    { M: 7 },
  );

  assert.equal(result.error, '');
  assert.deepEqual(result.lines, ['8']);
  assert.equal(result.variables.M, 8);
});

test('follows conditional jumps and detects unknown labels', () => {
  const result = runProgram({ name: 'BRANCH', source: ['2→A', 'A>1⇒Goto 2', 'Disp 0', 'Lbl 2', 'Disp A'] }, []);
  assert.deepEqual(result.lines, ['2']);
  assert.equal(runProgram({ name: 'BAD', source: ['Goto 9'] }, []).error, 'Label 9 not found.');
});

test('reports explicit Error messages and stops execution', () => {
  const result = runProgram({
    name: 'FAIL',
    source: ['Disp 1', 'Error "bad: value"', 'Disp 2'],
  }, []);
  assert.deepEqual(result.lines, ['1']);
  assert.equal(result.error, 'bad: value');
  assert.equal(runProgram({ name: 'FAIL', source: ['Error'] }, []).error, 'Program error.');
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

test('runs For, While, If/Then and plot commands on the graph', () => {
  const result = runProgram({
    name: 'PLOT',
    source: [
      'ViewWindow 0, 2, 0, 0, 2, 0',
      'For 0 -> I To 2',
      '  PlotOn I, I',
      'Next I',
      '0 -> K',
      'While K < 2',
      '  K + 1 -> K',
      'LpWhile',
      'If K = 2',
      '  Then Disp K',
      'IfEnd',
    ],
  }, []);

  assert.equal(result.error, '');
  assert.deepEqual(result.lines, ['2']);
  assert.deepEqual(result.view, { xMin: 0, xMax: 2, xScale: 1, yMin: 0, yMax: 2, yScale: 1 });
  assert.deepEqual(
    result.graph.filter((action) => action.kind === 'plot').map((action) => [action.x, action.y]),
    [[0, 0], [1, 1], [2, 2]],
  );
});

test('supports Else, ClrText, WhileEnd and Do/LpWhile', () => {
  const result = runProgram({
    name: 'LOOPS',
    source: [
      'Disp 1',
      '2 -> A',
      'If A > 1',
      '  Then Disp 2',
      '  Else Disp 3',
      'IfEnd',
      'If A = 2 Then Disp 4',
      '0 -> K',
      'While K < 3',
      '  K + 1 -> K',
      'WhileEnd',
      'Disp K',
      'ClrText',
      '3 -> K',
      'Do',
      '  K - 1 -> K',
      'LpWhile K > 0',
      'Disp K',
    ],
  }, []);

  assert.equal(result.error, '');
  assert.deepEqual(result.lines, ['0']);
});

test('bundled Mandelbrot sample stays importable', async () => {
  const data = JSON.parse(await readFile(new URL('../mandelbrot.json', import.meta.url), 'utf8'));
  const [program] = validatePrograms(data);
  assert.equal(program.name, 'MANDELBR');
  assert.ok(program.source.some((line) => /^For\s+0\s*->\s*J\s+To\s+62$/i.test(line)));
  assert.ok(program.source.some((line) => /(?:Then\s+)?PlotOn X, Y$/i.test(line)));
});

test('bundled sine sample graphs one point per column', async () => {
  const data = JSON.parse(await readFile(new URL('../sine.json', import.meta.url), 'utf8'));
  const [program] = validatePrograms(data);
  const result = runProgram(program, [program]);
  const plots = result.graph.filter((action) => action.kind === 'plot' && action.on);

  assert.equal(result.error, '');
  assert.equal(program.name, 'SINEWAVE');
  assert.equal(plots.length, 128);
  assert.ok(plots.every((point) => point.y >= -1 && point.y <= 1));
});

test('imports plain text programs and string-valued JSON source', async () => {
  const file = new File(["' comment\n10 -> A\nDisp A\n"], 'my-demo.bas');
  const [program] = await readPrograms(file);
  assert.equal(program.name, 'MYDEMO');
  assert.deepEqual(program.source, ["' comment", '10 -> A', 'Disp A']);
  assert.deepEqual(
    validatePrograms({ name: 'ONE', source: 'Disp 1\nDisp 2' }),
    [{ name: 'ONE', source: ['Disp 1', 'Disp 2'] }],
  );
});

test('demo JSON contains valid programs', async () => {
  const data = JSON.parse(await readFile(new URL('../demo-program.json', import.meta.url), 'utf8'));
  assert.equal(validatePrograms(data).length, 2);
});
