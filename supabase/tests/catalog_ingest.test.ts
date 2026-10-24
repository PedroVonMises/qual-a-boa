import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { datasetToSql } from '../seed/sql';
import { asRole, createDb, FIXED_NOW, search, type DB } from './harness';

const VENUE = '11111111-1111-4111-8111-111111111111';
const ALIAS_VENUE = '22222222-2222-4222-8222-222222222222';

let db: DB;
before(async () => {
  db = await createDb();
  await db.exec(datasetToSql(buildSeed(new Date(FIXED_NOW))));
  await db.exec(`insert into public.venues (id, slug, name, area, lat, lng) values
    ('${VENUE}', 'ingest-v', 'Ingest V', 'Centro', -20.3, -40.3)`);
});
after(async () => { await db.close(); });

const addEvent = (cols: string, vals: string) =>
  db.exec(`insert into public.events (venue_id, title, starts_at, ${cols}) values ('${VENUE}', 't', now(), ${vals})`);

describe('0006 catalog ingest', () => {
  test('source_url and image_url must be https', async () => {
    await addEvent('source_url, image_url', `'https://a.example/e/1', 'https://a.example/i.jpg'`);
    await assert.rejects(addEvent('source_url', `'http://a.example/e/1'`));
    await assert.rejects(addEvent('image_url', `'http://a.example/i.jpg'`));
    await assert.rejects(addEvent('image_url', `'javascript:alert(1)'`));
    await assert.rejects(addEvent('image_url', `'https://user@a.example/i.jpg'`));
  });

  test('(source, source_id) is unique when both are set', async () => {
    await addEvent('source, source_id', `'manual', 'x1'`);
    await assert.rejects(addEvent('source, source_id', `'manual', 'x1'`));
    await addEvent('source, source_id', `'link', 'x1'`);
    await addEvent('source', `'manual'`);
    await addEvent('source', `'manual'`);
    await addEvent('source_id', `'x1'`);
    await addEvent('source_id', `'x1'`);
  });

  test('cover_key regex accepts generated and legacy keys, rejects bad ones', async () => {
    await db.exec(`update public.events set cover_key = 'art:sun:p3:v1' where source_id = 'x1' and source = 'link'`);
    await db.exec(`update public.venues set cover_key = 'art:sun:p3:v1' where id = '${VENUE}'`);
    await db.exec(`update public.venues set cover_key = 'bolt' where id = '${VENUE}'`);
    for (const bad of ['', 'Art:Sun', 'art sun', 'a'.repeat(49), 'art/sun']) {
      await assert.rejects(db.query(`update public.events set cover_key = $1 where source = 'link'`, [bad]), `events ${bad}`);
      await assert.rejects(db.query(`update public.venues set cover_key = $1 where id = '${VENUE}'`, [bad]), `venues ${bad}`);
    }
  });

  test('venue_aliases: unique alias, public read, writes only service_role', async () => {
    await db.exec(`insert into public.venues (id, slug, name, area, lat, lng) values
      ('${ALIAS_VENUE}', 'alias-v', 'Alias V', 'Centro', -20.3, -40.3)`);
    await asRole(db, 'service_role', null, () => db.exec(`insert into public.venue_aliases values ('${VENUE}', 'bolt club')`));
    await assert.rejects(
      asRole(db, 'service_role', null, () => db.exec(`insert into public.venue_aliases values ('${ALIAS_VENUE}', 'bolt club')`)),
    );
    for (const role of ['anon', 'authenticated'] as const) {
      const r = await asRole(db, role, role === 'anon' ? null : VENUE, () =>
        db.query(`select alias from public.venue_aliases`));
      assert.equal(r.rows.length, 1, `${role} can read`);
      await assert.rejects(asRole(db, role, VENUE, () => db.exec(`insert into public.venue_aliases values ('${VENUE}', 'x')`)));
      await assert.rejects(asRole(db, role, VENUE, () => db.exec(`update public.venue_aliases set alias = 'y'`)));
      await assert.rejects(asRole(db, role, VENUE, () => db.exec(`delete from public.venue_aliases`)));
    }
  });

  test('search_events returns image_url', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    await db.exec(`insert into public.events (id, venue_id, title, starts_at, status, image_url)
      values ('${id}', '${VENUE}', 'Com cartaz', '2026-10-25T22:00:00Z', 'published', 'https://a.example/p.jpg')`);
    const r = await asRole(db, 'anon', null, () =>
      search(db, { lat: -20.3, lng: -40.3, radiusKm: 50, sort: 'date', now: FIXED_NOW, limit: 100 }));
    type Row = { id: string; image_url: string | null };
    const rows = r.rows as unknown as Row[];
    assert.equal(rows.find((x) => x.id === id)?.image_url, 'https://a.example/p.jpg');
    assert.ok(rows.some((x) => x.image_url === null), 'others stay null');
  });
});
