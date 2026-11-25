import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateExpression } from '../dist/machine.js';
import { functionExpression, keyActionFor, keypadRows } from '../dist/keypad.js';

const keys = keypadRows.flat();
const keyFor = (label) => {
  const key = keys.find((candidate) => candidate.label === label);
  assert.ok(key, `Missing ${label} key`);
  return key;
};

test('keypad includes the requested scientific and memory keys', () => {
  for (const label of [
    'SHIFT', 'AC', 'sin', 'cos', 'tan', 'log', 'ln', 'M in', 'M read', 'x²', 'π', '(-)',
  ]) {
    assert.ok(keys.some((key) => key.label === label), `Missing ${label} key`);
  }

  assert.equal(keys.some((key) => key.label === '√'), false, '√ should be a shifted function');
  assert.deepEqual(keyActionFor(keyFor('M in'), false), { kind: 'memoryStore' });
  assert.deepEqual(keyActionFor(keyFor('M read'), false), { kind: 'memoryRead' });
  assert.deepEqual(keyActionFor(keyFor('AC'), false), { kind: 'clearAll' });
  assert.deepEqual(keyActionFor(keyFor('π'), false), { kind: 'constant', value: 'pi' });
  assert.deepEqual(keyActionFor(keyFor('(-)'), false), { kind: 'negative' });
  assert.equal(keyFor('SHIFT').action.kind, 'shift');
});

test('SHIFT selects inverse trig, inverse log, square root and exponent functions', () => {
  assert.deepEqual(keyActionFor(keyFor('sin'), false), { kind: 'function', value: 'sin' });
  assert.deepEqual(keyActionFor(keyFor('sin'), true), { kind: 'function', value: 'asin' });
  assert.deepEqual(keyActionFor(keyFor('cos'), true), { kind: 'function', value: 'acos' });
  assert.deepEqual(keyActionFor(keyFor('tan'), true), { kind: 'function', value: 'atan' });
  assert.deepEqual(keyActionFor(keyFor('log'), true), { kind: 'function', value: 'exp10' });
  assert.deepEqual(keyActionFor(keyFor('ln'), true), { kind: 'function', value: 'exp' });
  assert.deepEqual(keyActionFor(keyFor('x²'), false), { kind: 'function', value: 'square' });
  assert.deepEqual(keyActionFor(keyFor('x²'), true), { kind: 'function', value: 'sqrt' });

  assert.deepEqual(keyActionFor(keyFor('M read'), true), { kind: 'memoryRead' });
});

test('π and (-) use expressions the evaluator understands', () => {
  assert.ok(Math.abs(evaluateExpression('π') - Math.PI) < 1e-12);
  assert.equal(evaluateExpression('-(5)'), -5);
  assert.equal(evaluateExpression('2π'), 2 * Math.PI);
});

test('keypad function expressions are understood by the evaluator', () => {
  const cases = [
    ['sin', '0', 0],
    ['cos', '0', 1],
    ['tan', '0', 0],
    ['asin', '0', 0],
    ['acos', '1', 0],
    ['atan', '0', 0],
    ['log', '100', 2],
    ['ln', '1', 0],
    ['exp10', '2', 100],
    ['exp', '0', 1],
    ['inverse', '4', 0.25],
    ['square', '3', 9],
    ['sqrt', '9', 3],
  ];

  for (const [name, input, expected] of cases) {
    const answer = evaluateExpression(functionExpression(name, input));
    assert.ok(Math.abs(answer - expected) < 1e-9, `${name}(${input}) returned ${answer}`);
  }
});
