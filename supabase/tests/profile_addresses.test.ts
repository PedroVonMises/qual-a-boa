import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { asRole, createDb, type DB } from './harness';

const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000b1';

const insertSql = `insert into public.profile_addresses (cep, street, number, complement, district, city, uf, lat, lng)
  values ($1, 'Rua da Lama', '10', null, 'Jardim da Penha', 'Vitória', 'ES', -20.28, -40.29)`;

let db: DB;
before(async () => {
  db = await createDb();
  await db.exec(`insert into auth.users (id) values ('${USER_A}'), ('${USER_B}')`);
});
after(async () => { await db.close(); });

describe('profile_addresses', () => {
  test('owner writes (user_id defaults to auth.uid()) and reads their own row', async () => {
    await asRole(db, 'authenticated', USER_A, async () => {
      await db.query(insertSql, ['29060000']);
      const r = await db.query<{ user_id: string; cep: string; uf: string }>('select user_id, cep, uf from public.profile_addresses');
      assert.deepEqual(r.rows, [{ user_id: USER_A, cep: '29060000', uf: 'ES' }]);
      const upd = await db.query(`update public.profile_addresses set number = '12' where user_id = $1`, [USER_A]);
      assert.equal(upd.affectedRows, 1);
      await db.query(
        `insert into public.profile_addresses (user_id, cep, street, number, district, city, uf)
         values ($1, '29060001', 'Rua B', '1', 'Centro', 'Vitória', 'ES')
         on conflict (user_id) do update set cep = excluded.cep`,
        [USER_A],
      );
    });
    const r = await db.query<{ cep: string; number: string }>('select cep, number from public.profile_addresses');
    assert.deepEqual(r.rows, [{ cep: '29060001', number: '12' }]);
  });

  test('another user cannot read, change, delete or insert for someone else', async () => {
    await asRole(db, 'authenticated', USER_B, async () => {
      assert.equal((await db.query('select * from public.profile_addresses')).rows.length, 0);
      const upd = await db.query(`update public.profile_addresses set street = 'x' where user_id = $1`, [USER_A]);
      assert.equal(upd.affectedRows, 0);
      const del = await db.query(`delete from public.profile_addresses where user_id = $1`, [USER_A]);
      assert.equal(del.affectedRows, 0);
      await assert.rejects(
        db.query(
          `insert into public.profile_addresses (user_id, cep, street, number, district, city, uf)
           values ($1, '29060000', 'R', '1', 'D', 'C', 'ES')`,
          [USER_A],
        ),
      );
    });
    const r = await db.query<{ street: string }>('select street from public.profile_addresses');
    assert.deepEqual(r.rows, [{ street: 'Rua da Lama' }]);
  });

  test('anon has no access', async () => {
    await asRole(db, 'anon', null, async () => {
      await assert.rejects(db.query('select * from public.profile_addresses'));
      await assert.rejects(db.query(insertSql, ['29060000']));
    });
  });

  test('constraints reject a bad CEP or UF', async () => {
    await asRole(db, 'authenticated', USER_B, async () => {
      await assert.rejects(db.query(insertSql, ['2906-000']));
      await assert.rejects(db.query(insertSql, ['290600']));
      await assert.rejects(
        db.query(`insert into public.profile_addresses (cep, street, number, district, city, uf)
                  values ('29060000', 'R', '1', 'D', 'C', 'es')`),
      );
    });
  });

  test('deleting the auth user cascades to the address', async () => {
    await db.exec(`delete from auth.users where id = '${USER_A}'`);
    assert.equal((await db.query('select * from public.profile_addresses')).rows.length, 0);
  });
});
