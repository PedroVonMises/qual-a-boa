import assert from 'node:assert/strict';
import { test } from 'node:test';

import { looksFree, parseBRL, pricesInText, toOffsetISO, toUTC } from './parse.js';

test('parseBRL handles Brazilian and dot formats', () => {
  assert.equal(parseBRL('R$ 40'), 40);
  assert.equal(parseBRL('R$ 1.234,56'), 1234.56);
  assert.equal(parseBRL('40,5'), 40.5);
  assert.equal(parseBRL('40.00'), 40);
  assert.equal(parseBRL('1.500'), 1500);
  assert.equal(parseBRL('25,00'), 25);
  assert.equal(parseBRL(30), 30);
  assert.equal(parseBRL('sem preço'), null);
  assert.equal(parseBRL(''), null);
  assert.equal(parseBRL(-1), null);
});

test('looksFree detects free entry wording', () => {
  assert.ok(looksFree('Entrada gratuita até 23h'));
  assert.ok(looksFree('GRÁTIS'));
  assert.ok(looksFree('Entrada franca'));
  assert.ok(!looksFree('Ingresso R$ 40'));
  assert.ok(!looksFree(undefined));
});

test('pricesInText reads every R$ amount', () => {
  assert.deepEqual(pricesInText('1º lote R$ 30, 2º lote R$ 1.200,00'), [30, 1200]);
});

test('local times are -03:00 and convert to UTC', () => {
  assert.equal(toOffsetISO('2026-11-14T23:00'), '2026-11-14T23:00:00-03:00');
  assert.equal(toUTC('2026-11-14T23:00:00-03:00'), '2026-11-15T02:00:00.000Z');
  assert.equal(toUTC('2026-11-14T23:00'), '2026-11-15T02:00:00.000Z');
  assert.equal(toUTC('2026-11-14T23:00:00Z'), '2026-11-14T23:00:00.000Z');
  assert.equal(toUTC('2026-11-14T23:00:00+0000'), '2026-11-14T23:00:00.000Z');
  assert.equal(toUTC('2026-11-14T23:00:00.000Z'), '2026-11-14T23:00:00.000Z');
});

test('date-only and garbage are rejected, never guessed', () => {
  assert.equal(toOffsetISO('2026-11-14'), null);
  assert.equal(toOffsetISO('sábado à noite'), null);
  assert.equal(toUTC('2026-13-45T25:00:00'), null);
});
