import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { FIXED_NOW, FIXTURE_DATA } from '../test/helpers.js';
import { createManualAdapter, csvToRecords, parseCsv, parseLocalDate, parseLocalTime, recordToRaw } from './adapters/manual.js';
import { USER_AGENT } from './types.js';

const ctx = { now: FIXED_NOW, userAgent: USER_AGENT, dataDir: FIXTURE_DATA, log: () => {} };

test('csv parser: quotes, embedded commas/newlines, semicolon delimiter, BOM', () => {
  assert.deepEqual(parseCsv('﻿a,b\n"x, y","line1\nline2"\n'), [['a', 'b'], ['x, y', 'line1\nline2']]);
  assert.deepEqual(parseCsv('a;b\r\n1;2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\n"he said ""hi""",2'), [['a', 'b'], ['he said "hi"', '2']]);
});

test('local date/time parsing', () => {
  assert.equal(parseLocalDate('14/11/2026'), '2026-11-14');
  assert.equal(parseLocalDate('4/1/27'), '2027-01-04');
  assert.equal(parseLocalDate('2026-11-14 10:00'), '2026-11-14');
  assert.equal(parseLocalTime('23h'), '23:00');
  assert.equal(parseLocalTime('16h30'), '16:30');
  assert.equal(parseLocalTime('9:05'), '09:05');
  assert.equal(parseLocalTime('25:00'), null);
});

test('google form columns map to records', () => {
  const recs = csvToRecords(
    'Carimbo de data/hora,Nome do evento,Local,Data,Horário de início,Horário de término,Valor mínimo,Gratuito?,Idade mínima,Atrações\n' +
      '1,Festa X,Bolt,14/11/2026,23:00,04:00,"R$ 20,00",Não,16 anos,"A; B"\n',
  );
  assert.equal(recs.length, 1);
  const r = recs[0]!;
  assert.equal(r.title, 'Festa X');
  assert.equal(r.venue, 'Bolt');
  assert.equal(r.ageMin, 16);
  assert.equal(r.isFree, false);
  const { event } = recordToRaw(r, FIXED_NOW.toISOString());
  assert.ok(event);
  assert.equal(event.startsAt, '2026-11-14T23:00:00-03:00');
  assert.equal(event.endsAt, '2026-11-15T04:00:00-03:00', 'end before start rolls to next day');
  assert.equal(event.priceMin, 20);
  assert.deepEqual(event.lineup, ['A', 'B']);
});

test('recordToRaw: price text, free, errors', () => {
  const f = FIXED_NOW.toISOString();
  const base = { title: 'T', venue: 'V', startsAt: '2026-12-01T20:00:00-03:00' };
  assert.equal(recordToRaw({ ...base, price: 'R$ 30 a R$ 50' }, f).event?.priceMax, 50);
  assert.equal(recordToRaw({ ...base, price: 'Gratuito' }, f).event?.isFree, true);
  assert.equal(recordToRaw({ ...base, priceMin: 10 }, f).event?.priceMax, 10);
  assert.match(recordToRaw({ title: 'T', venue: 'V' }, f).problem ?? '', /start/);
  assert.match(recordToRaw({ venue: 'V' }, f).problem ?? '', /title/);
  assert.match(recordToRaw({ title: 'T' }, f).problem ?? '', /venue/);
  // stable ids: same input, same sourceId
  assert.equal(recordToRaw(base, f).event?.sourceId, recordToRaw(base, f).event?.sourceId);
});

test('adapter reads fixture curated dir (json + csv) and reports invalid records', async () => {
  const a = createManualAdapter(FIXTURE_DATA);
  assert.equal(a.tier, 1);
  const events = await a.fetch(ctx);
  assert.equal(events.length, 4);
  assert.ok(events.every((e) => e.source === 'manual'));
  assert.equal(a.report.needsReview.length, 1);
  assert.match(a.report.needsReview[0]!.ref, /casas\.json#3/);
  const samba = events.find((e) => e.title === 'Roda de Samba da Penha')!;
  assert.equal(samba.isFree, true);
  assert.equal(samba.startsAt, '2026-11-28T16:30:00-03:00');
  assert.deepEqual(samba.lineup, ['Grupo Raiz do Canto', 'Samba de Quintal']);
  assert.equal(samba.url, '');
});

test('unreadable files become needs-review, missing dir is fine', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ingest-'));
  assert.deepEqual(await createManualAdapter(dir).fetch(ctx), []);
  await mkdir(join(dir, 'curated'));
  await writeFile(join(dir, 'curated', 'bad.json'), '{ nope');
  const a = createManualAdapter(dir);
  assert.deepEqual(await a.fetch(ctx), []);
  assert.match(a.report.needsReview[0]!.reason, /unreadable/);
});
