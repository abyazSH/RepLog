import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { emptyData, newWorkout, stateSchema } from "../lib/model";
test("Supabase migration: permissions, RLS, email identity and atomic revisions", async (t) => {
  const db = new PGlite();
  const a = "00000000-0000-0000-0000-000000000001",
    b = "00000000-0000-0000-0000-000000000002",
    c = "00000000-0000-0000-0000-000000000003";
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.identities(user_id uuid,provider text,identity_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to authenticated,anon;
 insert into auth.users values ('${a}','a@example.com',now()),('${b}','b@example.com',now()),('${c}','outsider@example.com',now());
 insert into auth.identities select id,'email',jsonb_build_object('email',email,'email_verified',true) from auth.users;`);
    await db.exec(readFileSync("supabase/migrations/001_replog.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/002_email_password.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/002_email_password.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/003_custom_programs.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/003_custom_programs.sql", "utf8"));
    await db.exec(
      "insert into replog_private.allowed_emails values ('a@example.com'),('b@example.com');",
    );
    async function actor(id: string) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    }
    async function save(revision: number) {
      return db.query<{ revision: number }>(
        "select public.replog_save_state($1,$2::jsonb) as revision",
        [revision, JSON.stringify(emptyData())],
      );
    }
    await t.test(
      "allowed account can save and update; stale writes conflict",
      async () => {
        await actor(a);
        assert.equal((await save(0)).rows[0].revision, 1);
        assert.equal((await save(1)).rows[0].revision, 2);
        await assert.rejects(() => save(0), { code: "40001" });
        await assert.rejects(() => save(1), { code: "40001" });
      },
    );
    await t.test(
      "RLS hides another user; RPC always uses authenticated owner",
      async () => {
        await actor(b);
        assert.equal(
          (await db.query("select * from public.workout_state")).rows.length,
          0,
        );
        await save(0);
        const rows = (
          await db.query<{ user_id: string }>(
            "select user_id from public.workout_state",
          )
        ).rows;
        assert.deepEqual(rows, [{ user_id: b }]);
      },
    );
    await t.test("custom schedules and empty program lists remain private per user", async () => {
      await actor(a);
      const custom = emptyData(); custom.templates[0].name = "My custom pull"; custom.templates[0].day = 0;
      await db.query("select public.replog_save_state($1,$2::jsonb)", [2,JSON.stringify(custom)]);
      await actor(b);
      const cleared = emptyData(); cleared.templates = [];
      await db.query("select public.replog_save_state($1,$2::jsonb)", [1,JSON.stringify(cleared)]);
      assert.deepEqual((await db.query<{data:{templates:unknown[]}}>("select data from public.workout_state")).rows[0].data.templates,[]);
      await actor(a);
      assert.equal((await db.query<{data:{templates:{name:string;day:number}[]}}>("select data from public.workout_state")).rows[0].data.templates[0].name,"My custom pull");
      const tooMany=emptyData(); tooMany.templates=Array.from({length:21},()=>structuredClone(custom.templates[0]));
      await assert.rejects(()=>db.query("select public.replog_save_state($1,$2::jsonb)",[3,JSON.stringify(tooMany)]),{code:"22023"});
    });
    await t.test("cardio templates and records round-trip through the existing RPC", async()=>{
      await actor(a);
      const state=emptyData();const template=state.templates[0];
      template.exercises[0]={...template.exercises[0],tracking:"treadmill",targetMinutes:20};
      const workout=newWorkout(template);workout.finished=true;
      workout.exercises[0].cardio={...workout.exercises[0].cardio!,durationMinutes:"20",speedKmh:"6",inclinePercent:"5",done:true};
      state.sessions=[workout];stateSchema.parse(state);
      await db.query("select public.replog_save_state($1,$2::jsonb)",[3,JSON.stringify(state)]);
      const row=(await db.query<{data:unknown}>("select data from public.workout_state")).rows[0];
      const loaded=stateSchema.parse(row.data);
      assert.equal(loaded.sessions[0].exercises[0].cardio?.speedKmh,"6");
      assert.equal(loaded.templates[0].exercises[0].tracking,"treadmill");
    });
    await t.test(
      "direct writes and reading the invitation list are denied",
      async () => {
        await assert.rejects(
          () => db.query("update public.workout_state set revision=9"),
          { code: "42501" },
        );
        await assert.rejects(
          () => db.query("select * from replog_private.allowed_emails"),
          { code: "42501" },
        );
      },
    );
    await t.test("confirmed email account can save without an invitation", async () => {
      await actor(c);
      assert.equal((await save(0)).rows[0].revision,1);
      assert.deepEqual((await db.query("select user_id from public.workout_state")).rows,[{user_id:c}]);
    });
    await t.test("unconfirmed email account cannot read or save", async () => {
      await db.exec(`reset role;update auth.users set email_confirmed_at=null where id='${b}'`);
      await actor(b);
      assert.equal((await db.query("select * from public.workout_state")).rows.length,0);
      await assert.rejects(()=>save(1),{code:"42501"});
    });
    await t.test("Google-only identity cannot use password application",async()=>{
      await db.exec(`reset role;update auth.identities set provider='google' where user_id='${a}'`);
      await actor(a);
      await assert.rejects(()=>save(2),{code:"42501"});
    });
    await t.test("anonymous callers cannot invoke storage RPC", async () => {
      await db.exec("reset role;set role anon");
      await assert.rejects(() => save(0), { code: "42501" });
    });
  } finally {
    await db.close();
  }
});
