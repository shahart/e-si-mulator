import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLinks } from '../dist/programs.js';

test('finds URLs in program source and reports their positions', () => {
  const source = [
    "' Max iterations in M",
    "' https://en.wikipedia.org/wiki/Mandelbrot_set",
    "20 -> M",
  ].join('\n');

  const links = sourceLinks(source);
  assert.equal(links.length, 1);
  assert.equal(links[0].url, 'https://en.wikipedia.org/wiki/Mandelbrot_set');
  assert.equal(source.slice(links[0].start, links[0].end), links[0].url);
});

test('keeps every URL and strips trailing punctuation from its range', () => {
  const source = "' https://example.com/docs, and http://example.org.";
  const links = sourceLinks(source);
  assert.deepEqual(links.map((link) => link.url), [
    'https://example.com/docs',
    'http://example.org',
  ]);
  for (const link of links) {
    assert.equal(source.slice(link.start, link.end), link.url);
  }
});

test('ignores text that is not an http URL', () => {
  assert.deepEqual(sourceLinks([
    'Disp "Use javascript:alert(1) here"',
    "' ftp://example.com/file",
    "' www.example.com",
  ].join('\n')), []);
});
