import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { fuzzyMatch } from '../src/domain/fuzzy.ts';
import { type Hint, fitHints, hintsWidth } from '../src/interfaces/tui/hints.ts';
import { BINDINGS, footerHints, helpSections, keyToken, resolve } from '../src/interfaces/tui/keys.ts';
import { sortBy } from '../src/domain/sort.ts';

const hints: Hint[] = [
  { key: '↑↓', label: 'move', priority: 'normal' },
  { key: 'space', label: 'toggle', priority: 'essential' },
  { key: 'ctrl+r', label: 'rescan', priority: 'optional' },
  { key: 'm', label: 'map', priority: 'optional' },
  { key: 'd', label: 'clean', priority: 'essential' },
  { key: 'esc', label: 'back', priority: 'normal' },
  { key: 'q', label: 'quit', priority: 'essential' },
];

test('footer hints shorten modifiers, then drop low-priority hints, never essential or esc', () => {
  assert.deepEqual(fitHints(hints, 200).hints.map((h) => h.key), hints.map((h) => h.key));
  const full = hintsWidth(hints);
  assert.equal(fitHints(hints, full - 3).hints.find((h) => h.label === 'rescan')?.key, '^r');
  const narrow = fitHints(hints, 50).hints;
  assert.ok(hintsWidth(narrow) <= 50);
  for (const label of ['toggle', 'clean', 'quit', 'back']) assert.ok(narrow.some((h) => h.label === label), label);
  assert.ok(!narrow.some((h) => h.label === 'rescan'));
  const tiny = fitHints(hints, 30);
  assert.ok(hintsWidth(tiny.hints) <= 30);
  assert.ok(tiny.hints.every((h) => ['space', 'd', 'esc', 'q'].includes(h.key)));
});

test('a long low-priority hint dropped early does not take a short one with it', () => {
  const list: Hint[] = [
    { key: 'a', label: 'aaaaaaaaaaaaaaaaaaaa', priority: 'optional' },
    { key: 'b', label: 'b', priority: 'optional' },
    { key: 'q', label: 'quit', priority: 'essential' },
  ];
  assert.deepEqual(fitHints(list, 12).hints.map((h) => h.key), ['b', 'q']);
});

test('fuzzy matching prefers word starts and consecutive letters', () => {
  assert.equal(fuzzyMatch('node_modules', 'xyz'), null);
  assert.deepEqual(fuzzyMatch('~/Code/web/node_modules', 'nm')?.positions, [11, 16]);
  const start = fuzzyMatch('bravo', 'bra')!.score;
  const middle = fuzzyMatch('abracadabra', 'bra')!.score;
  assert.ok(start > middle);
});

test('sorting by size, age and name, and reversed', () => {
  const items = [{ name: 'b', size: 1, age: 9 }, { name: 'a', size: 5, age: 1 }, { name: 'c', size: 3, age: 4 }];
  const names = (key: 'size' | 'age' | 'name', reverse = false) => sortBy(items, { key, reverse }, (i) => i).map((i) => i.name);
  assert.deepEqual(names('size'), ['a', 'c', 'b']);
  assert.deepEqual(names('age'), ['b', 'c', 'a']);
  assert.deepEqual(names('name'), ['a', 'b', 'c']);
  assert.deepEqual(names('size', true), ['b', 'c', 'a']);
});

test('one key registry drives dispatch, the footer and the help screen', () => {
  assert.equal(resolve('list', keyToken({ name: 'j', sequence: 'j', shift: false, ctrl: false, meta: false })), 'down');
  assert.equal(resolve('map', 'right'), 'next');
  assert.equal(resolve('list', 'right'), 'expand');
  assert.equal(resolve('review', 'y'), 'confirm');
  assert.equal(resolve('list', 'w'), undefined);
  assert.equal(resolve('welcome', 'x'), 'dismiss');
  assert.equal(keyToken({ name: 'tab', sequence: '\t', shift: true, ctrl: false, meta: false }), 'shift+tab');
  assert.ok(footerHints('list').some((h) => h.key === 'enter/f' && h.label === 'files'));
  assert.ok(!footerHints('list').some((h) => h.label === 'move up'));
  const sections = helpSections();
  assert.ok(sections.some((s) => s.title === 'Views' && s.rows.some((r) => r.label === 'clear the filter, or stop a running cleanup')));
  for (const context of new Set(BINDINGS.flatMap((b) => b.contexts))) {
    const seen = new Map<string, string>();
    for (const b of BINDINGS.filter((x) => x.contexts.includes(context))) {
      for (const k of b.keys) {
        assert.ok(!seen.has(k) || seen.get(k) === b.action, `${context}: ${k} bound to ${seen.get(k)} and ${b.action}`);
        seen.set(k, b.action);
      }
    }
  }
});
