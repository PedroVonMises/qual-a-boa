import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

// Informações de volta da casa (0022).
const ds = buildSeed(new Date(FIXED_NOW));
const MARE = ds.venues.find((v) => v.slug === 'casa-mare')!.id;
const BOLT = ds.venues.find((v) => v.slug === 'bolt')!.id;
const O = '00000000-0000-4000-8000-0000000000f1';
const X = '00000000-0000-4000-8000-0000000000f2';
const CNPJ = '11222333000181';

let db: DB;
let acc: string;

const as = <T>(user: string | null, fn: () => Promise<T>) => asRole(db, user ? 'authenticated' : 'anon', user, fn);
const set = (info: unknown) =>
  db.query<{ r: Record<string, string> }>(`select public.set_return_info($1, $2::jsonb) as r`, [acc, JSON.stringify(info)]).then((r) => r.rows[0].r);
const publicInfo = (venue: string) =>
  as(null, () => db.query<{ return_info: Record<string, string>; return_info_at: string | null }>(
    `select return_info, return_info_at from public.venues where id = $1`, [venue])).then((r) => r.rows[0]);

before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ('${O}'), ('${X}')`);
  acc = (await as(O, () =>
    db.query<{ id: string }>(`select public.claim_venue($1, null, $2, 'Casa Maré Ltda', 'Ana', '+5527999990000') as id`, [MARE, CNPJ]))).rows[0].id;
  await db.exec(`update public.venues set return_info = '{}', return_info_at = null`);
});
after(async () => { await db.close(); });

describe('return info (0022)', () => {
  test('starts empty; only known keys and values pass the check; clients cannot write venues', async () => {
    assert.deepEqual(await publicInfo(BOLT), { return_info: {}, return_info_at: null });
    for (const bad of [{ parking: 'talvez' }, { lit_street: true }, { outra: 'x' }, { bus_stop: 'x' }]) {
      await assert.rejects(db.query(`update public.venues set return_info = $1::jsonb where id = $2`, [JSON.stringify(bad), BOLT]), /check constraint/);
    }
    await as(O, () => assert.rejects(db.query(`update public.venues set return_info = '{}' where id = $1`, [MARE]), /permission denied/));
    await as(null, () => assert.rejects(set({ parking: 'rua' }), /permission denied/));
  });

  test('a pending account cannot save; strangers never', async () => {
    await as(O, () => assert.rejects(set({ parking: 'rua' }), /account_not_verified/));
    await as(X, () => assert.rejects(set({ parking: 'rua' }), /not_member/));
  });

  test('a verified casa saves it (any plan): texts are trimmed, empties dropped, bad values refused', async () => {
    await db.exec(`update public.venue_accounts set status = 'verified' where id = '${acc}'`);
    await as(O, async () => {
      await assert.rejects(set({ parking: 'valet' }), /invalid_payload/);
      await assert.rejects(set({ lit_street: 1 }), /invalid_payload/);
      await assert.rejects(set({ bus_stop: 'x'.repeat(141) }), /invalid_payload/);
      await assert.rejects(set([]), /invalid_payload/);
      const r = await set({ rideshare_point: '  Em frente à   farmácia ', bus_stop: '', lit_street: 'em_parte', parking: 'conveniado', staff: null });
      assert.deepEqual(r, { rideshare_point: 'Em frente à farmácia', lit_street: 'em_parte', parking: 'conveniado' });
    });
    const p = await publicInfo(MARE);
    assert.deepEqual(p.return_info, { rideshare_point: 'Em frente à farmácia', lit_street: 'em_parte', parking: 'conveniado' });
    assert.ok(p.return_info_at);
    assert.deepEqual((await publicInfo(BOLT)).return_info, {});
    // Saving the whole block again replaces it.
    await as(O, () => set({ parking: 'rua' }));
    assert.deepEqual((await publicInfo(MARE)).return_info, { parking: 'rua' });
  });
});
