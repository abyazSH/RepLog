-- Run manually in Supabase SQL Editor. This is not a migration.
-- Change the email, program ID and exercise details before running.
do $$
declare
  target_email text := 'email-pengguna@gmail.com';
  program_id text := 'push-custom-001';
  target_user uuid;
  current_data jsonb;
  new_program jsonb;
begin
  select id into strict target_user
  from auth.users
  where lower(email) = lower(trim(target_email));

  -- Akun baru mendapat program bawaan; data akun yang sudah ada tidak diganti.
  insert into public.workout_state(user_id, revision, data)
  values (target_user, 1, '{"templates":[{"id":"pull","name":"Pull","day":1,"focus":"Punggung & biceps","exercises":[{"id":"lat-pulldown","name":"Lat Pulldown","kind":"C","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"cable-row","name":"Seated Cable Row","kind":"C","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"straight-pulldown","name":"Straight-Arm Pulldown","kind":"I","minReps":12,"maxReps":15,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"face-pull","name":"Face Pull","kind":"I","minReps":12,"maxReps":15,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"db-curl","name":"Dumbbell Curl","kind":"I","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":["Barbell Curl","Preacher Curl Machine"]}]},{"id":"push","name":"Push","day":2,"focus":"Dada, bahu & triceps","exercises":[{"id":"chest-press","name":"Chest Press","kind":"C","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":["Bench Press"]},{"id":"incline-machine","name":"Incline Machine Press","kind":"C","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"overhead-press","name":"Overhead Press","kind":"C","minReps":8,"maxReps":10,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"db-lateral","name":"Dumbbell Lateral Raise","kind":"I","minReps":12,"maxReps":15,"minSets":3,"maxSets":3,"alternatives":[]},{"id":"triceps-pushdown","name":"Triceps Pushdown","kind":"I","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":[]}]},{"id":"legs","name":"Legs","day":3,"focus":"Kaki","exercises":[{"id":"leg-press","name":"Leg Press","kind":"C","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"rdl","name":"Romanian Deadlift","kind":"C","minReps":8,"maxReps":10,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"leg-curl","name":"Leg Curl","kind":"I","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"leg-extension","name":"Leg Extension","kind":"I","minReps":12,"maxReps":15,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"calf-raise","name":"Calf Raise","kind":"I","minReps":12,"maxReps":15,"minSets":2,"maxSets":3,"alternatives":[]}]},{"id":"shoulders","name":"Shoulder + Arms","day":4,"focus":"Bahu & lengan","exercises":[{"id":"shoulder-machine","name":"Shoulder Press Machine","kind":"C","minReps":8,"maxReps":10,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"row-machine","name":"Seated Row Machine","kind":"C","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"lateral-machine","name":"Lateral Raise Machine","kind":"I","minReps":12,"maxReps":15,"minSets":3,"maxSets":3,"alternatives":[]},{"id":"reverse-fly","name":"Rear Delt / Pec Deck Machine","kind":"I","minReps":12,"maxReps":15,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"preacher","name":"Preacher Curl Machine","kind":"I","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":["Cable Curl"]},{"id":"triceps-pushdown","name":"Triceps Pushdown","kind":"I","minReps":10,"maxReps":12,"minSets":2,"maxSets":3,"alternatives":[]}]},{"id":"chest-core","name":"Chest + Core","day":6,"focus":"Dada & core","exercises":[{"id":"flat-machine","name":"Flat Machine Press","kind":"C","minReps":8,"maxReps":10,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"high-low","name":"High to Low Cable Fly","kind":"I","minReps":12,"maxReps":15,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"low-high","name":"Low to High Cable Fly","kind":"I","minReps":12,"maxReps":15,"minSets":2,"maxSets":3,"alternatives":[]},{"id":"ab-crunch","name":"Ab Crunch Machine","kind":"I","minReps":12,"maxReps":15,"minSets":2,"maxSets":3,"alternatives":[]}]}],"sessions":[],"draft":null,"weights":[]}'::jsonb)
  on conflict (user_id) do nothing;

  select data into current_data
  from public.workout_state
  where user_id = target_user
  for update;

  if jsonb_typeof(current_data->'templates') is distinct from 'array' then
    raise exception 'Format program pengguna tidak valid.';
  end if;
  if jsonb_array_length(current_data->'templates') >= 20 then
    raise exception 'Pengguna sudah memiliki 20 program.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(current_data->'templates') as t
    where t->>'id' = program_id
  ) then
    raise exception 'ID program sudah digunakan. Ganti program_id untuk menambahkan program lain.';
  end if;

  new_program := jsonb_build_object(
    'id', program_id,
    'name', 'Push Tambahan',
    'day', 2,
    'focus', 'Dada, bahu & triceps',
    'exercises', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text, 'name', 'Chest Press', 'kind', 'C',
        'minSets', 2, 'maxSets', 3, 'minReps', 10, 'maxReps', 12,
        'alternatives', jsonb_build_array()
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text, 'name', 'Triceps Pushdown', 'kind', 'I',
        'minSets', 2, 'maxSets', 3, 'minReps', 10, 'maxReps', 12,
        'alternatives', jsonb_build_array()
      )
    )
  );

  update public.workout_state
  set data = jsonb_set(
        current_data, '{templates}',
        (current_data->'templates') || jsonb_build_array(new_program)
      ),
      revision = revision + 1,
      updated_at = now()
  where user_id = target_user;
end;
$$;
