import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {emptyData,exercise,newWorkout,stateSchema,type Data} from '../lib/model';

const original=readFileSync('supabase/queries/set_hip_adduction_history.sql','utf8');
const query=original.replace("target_email text := 'GANTI_EMAIL_AKUN_REPLOG'", "target_email text := 'test@example.com'");
const user='00000000-0000-0000-0000-000000000001';
function fixture():Data {
  const data=emptyData();
  const template=data.templates.find(t=>t.id==='legs')!;
  data.sessions=['2026-11-04','2026-10-28'].map(date=>{
    const workout=newWorkout(template);workout.finished=true;workout.date=date+'T12:00:00.000Z';
    workout.exercises[0].sets=[{kg:'40',reps:'10',done:true}];
    workout.notes='Preserve this note';
    return workout;
  });
  data.sessions[1].exercises.push({exercise:exercise('existing-hip','Hip Adduction','I'),sets:[{kg:'50',reps:'8',done:true}]});
  data.draft=newWorkout(template);
  return data;
}

test('Hip Adduction history query updates only the two target records atomically and preserves the state schema',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key,email text);
      create table public.workout_state(user_id uuid primary key,revision integer,data jsonb,updated_at timestamptz default now());
      insert into auth.users values ('${user}','test@example.com');`);
    await assert.rejects(db.exec(query.replace("target_email text := 'test@example.com'", "target_email text := 'missing@example.com'")),/Akun dengan email .* tidak ditemukan/);
    await assert.rejects(db.exec(query),/Akun .* ditemukan, tetapi belum memiliki workout_state/);
    const before=fixture();stateSchema.parse(before);
    await db.query('insert into public.workout_state(user_id,revision,data) values ($1,1,$2::jsonb)',[user,JSON.stringify(before)]);
    const load=async()=> (await db.query<{revision:number;data:Data}>('select revision,data from public.workout_state')).rows[0];

    await assert.rejects(db.exec(original),/Isi target_email/);
    assert.deepEqual((await load()).data,before);
    await assert.rejects(db.exec(query.replace("date '2026-10-28'", "date '2026-10-21'")),/harus tepat 1/);
    assert.equal((await load()).revision,1);
    assert.deepEqual((await load()).data,before);

    await db.exec(query);
    const saved=await load();assert.equal(saved.revision,2);stateSchema.parse(saved.data);
    assert.deepEqual(saved.data.templates,before.templates);
    assert.deepEqual(saved.data.weights,before.weights);
    assert.deepEqual(saved.data.draft,before.draft);
    for(let i=0;i<2;i++) {
      const workout=saved.data.sessions[i];
      const targets=workout.exercises.filter(e=>e.exercise.name==='Hip Adduction');
      assert.equal(targets.length,1);
      assert.deepEqual(targets[0].sets,Array.from({length:3},()=>({kg:'30',reps:'12',done:true})));
      assert.deepEqual(workout.exercises.filter(e=>e.exercise.name!=='Hip Adduction'),before.sessions[i].exercises.filter(e=>e.exercise.name!=='Hip Adduction'));
      assert.deepEqual({...workout,exercises:[]},{...before.sessions[i],exercises:[]});
    }
    assert.deepEqual(saved.data.sessions[1].exercises.at(-1)!.exercise,before.sessions[1].exercises.at(-1)!.exercise);
    await db.exec(query);
    assert.deepEqual((await load()).data,saved.data);

    const duplicate=structuredClone(saved.data);
    duplicate.sessions.push({...structuredClone(duplicate.sessions[0]),id:'duplicate-session'});
    await db.query('update public.workout_state set data=$1::jsonb',[JSON.stringify(duplicate)]);
    await assert.rejects(db.exec(query),/harus tepat 1/);
    assert.deepEqual((await load()).data,duplicate);
  } finally {await db.close();}
});
