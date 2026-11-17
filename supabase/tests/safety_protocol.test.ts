import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

// Selo "Protocolo Não é Não" (0019).
const ds = buildSeed(new Date(FIXED_NOW));
const MARE = ds.venues.find((v) => v.slug === 'casa-mare')!.id;
const BOLT = ds.venues.find((v) => v.slug === 'bolt')!.id;
const O = '00000000-0000-4000-8000-0000000000b1'; // owner
const E = '00000000-0000-4000-8000-0000000000b2'; // editor
const X = '00000000-0000-4000-8000-0000000000b3'; // stranger
const CNPJ = '11222333000181';

let db: DB;
let acc: string;

const as = <T>(user: string | null, fn: () => Promise<T>) => asRole(db, user ? 'authenticated' : 'anon', user, fn);
const asService = <T>(fn: () => Promise<T>) => asRole(db, 'service_role', null, fn);

const declare = (account: string, name: string, path: string | null = null) =>
  db.query<{ s: string | null }>(`select public.declare_safety_protocol($1, $2, $3) as s`, [account, name, path]).then((r) => r.rows[0].s);
const review = (venue: string, decision: string, note: string | null = null) =>
  asService(() => db.query<{ s: string | null }>(`select public.review_safety_protocol($1, $2, $3) as s`, [venue, decision, note]))
    .then((r) => r.rows[0].s);
const mine = (user: string) =>
  as(user, () => db.query<Record<string, unknown>>(`select * from public.my_safety_protocol($1)`, [acc])).then((r) => r.rows[0]);
const publicState = (venue: string) =>
  as(null, () => db.query<{ safety_protocol: string | null }>(`select safety_protocol from public.venues where id = $1`, [venue]))
    .then((r) => r.rows[0].safety_protocol);
const evidence = (account: string) => `${account}/0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b.jpg`;

before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ('${O}'), ('${E}'), ('${X}')`);
  acc = (await as(O, () =>
    db.query<{ id: string }>(`select public.claim_venue($1, null, $2, 'Casa Maré Ltda', 'Ana', '+5527999990000') as id`, [MARE, CNPJ]))).rows[0].id;
  // The demo seed gives Casa Maré a verified seal; start from none.
  await asService(() => db.exec(`update public.venues set safety_protocol = null, safety_protocol_at = null`));
  await asService(() => db.exec(`insert into public.venue_members (venue_account_id, user_id, role) values ('${acc}', '${E}', 'editor')`));
});
after(async () => { await db.close(); });

describe('safety protocol seal (0019)', () => {
  test('nobody starts with the seal and clients cannot write it on venues', async () => {
    assert.equal(await publicState(MARE), null);
    await as(O, () => assert.rejects(db.query(`update public.venues set safety_protocol = 'verified' where id = $1`, [MARE]), /permission denied/));
    await as(O, () => assert.rejects(db.query(`select * from public.venue_safety_declarations`), /permission denied/));
    await as(null, () => assert.rejects(declare(acc, 'Ana Souza'), /permission denied/));
  });

  test('a pending account cannot declare; strangers never', async () => {
    await as(O, () => assert.rejects(declare(acc, 'Ana Souza'), /account_not_verified/));
    await as(X, () => assert.rejects(declare(acc, 'Ana Souza'), /not_member/));
    await as(X, () => assert.rejects(db.query(`select * from public.my_safety_protocol($1)`, [acc]), /not_member/));
  });

  test('a verified casa declares (no subscription needed) and the venue shows "declared"', async () => {
    await asService(() => db.exec(`update public.venue_accounts set status = 'verified' where id = '${acc}'`));
    await as(O, async () => {
      await assert.rejects(declare(acc, ' A '), /invalid_responsible/);
      await assert.rejects(declare(acc, 'Ana Souza', 'not-a-path.jpg'), /invalid_evidence/);
      // Evidence must sit in the account's own folder.
      await assert.rejects(declare(acc, 'Ana Souza', evidence('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c')), /invalid_evidence/);
      assert.equal(await declare(acc, '  Ana Souza ', evidence(acc)), 'declared');
    });
    assert.equal(await publicState(MARE), 'declared');
    assert.equal(await publicState(BOLT), null);
    const m = await mine(E);
    assert.equal(m.status, 'declared');
    assert.equal(m.responsible_name, 'Ana Souza');
    assert.equal(m.evidence_path, evidence(acc));
    assert.equal(m.reviewed_at, null);
  });

  test('only staff reviews; verify, then a re-declaration keeps verified and the photo', async () => {
    await as(O, () => assert.rejects(db.query(`select public.review_safety_protocol($1, 'verify')`, [MARE]), /permission denied/));
    await assert.rejects(review(BOLT, 'verify'), /protocol_not_declared/);
    await assert.rejects(review(MARE, 'approve'), /invalid_payload/);
    assert.equal(await review(MARE, 'verify', 'Cartaz conferido'), 'verified');
    assert.equal(await publicState(MARE), 'verified');
    assert.equal((await mine(O)).review_note, 'Cartaz conferido');

    assert.equal(await as(E, () => declare(acc, 'Bia Lima')), 'verified');
    const m = await mine(O);
    assert.equal(m.responsible_name, 'Bia Lima');
    assert.equal(m.evidence_path, evidence(acc));
    assert.equal(m.review_note, null);
  });

  test('a contest sticks until staff clears it; reject removes the seal and tells the casa why', async () => {
    assert.equal(await review(MARE, 'contest', 'Relatos de assédio sem resposta da equipe'), 'contested');
    assert.equal(await as(O, () => declare(acc, 'Ana Souza')), 'contested');
    assert.equal(await publicState(MARE), 'contested');

    assert.equal(await review(MARE, 'reject', 'Foto ilegível'), null);
    assert.equal(await publicState(MARE), null);
    const m = await mine(O);
    assert.equal(m.status, null);
    assert.equal(m.review_note, 'Foto ilegível');

    assert.equal(await as(O, () => declare(acc, 'Ana Souza')), 'declared');
    assert.equal((await mine(O)).review_note, null);
  });

  test('staff can contest a venue that never declared', async () => {
    assert.equal(await review(BOLT, 'contest', 'Relatos'), 'contested');
    assert.equal(await publicState(BOLT), 'contested');
  });
});
