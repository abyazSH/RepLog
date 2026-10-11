-- Jalankan manual di Supabase SQL Editor. Bukan migrasi.
-- Menambahkan tiga program dari query pengguna; akun baru mendapat program bawaan terlebih dahulu.
do $$
declare
  -- Ganti dengan email pengguna yang dituju
  target_email text := 'email-pengguna@gmail.com';

  target_user uuid;
  current_data jsonb;
  new_programs jsonb;
begin
  select id into strict target_user
  from auth.users
  where lower(email) = lower(trim(target_email));

  -- Buat data awal hanya jika akun belum mempunyai catatan tersimpan.
  -- Program bawaan RepLog tetap disertakan untuk akun baru.
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

  if jsonb_array_length(current_data->'templates') + 3 > 20 then
    raise exception 'Penambahan 3 program akan melewati batas 20 program.';
  end if;

  new_programs := jsonb_build_array(

    -- Hari 1: Leg Day
    jsonb_build_object(
      'id', 'leg-day-custom-001',
      'name', 'Leg Day',
      'day', 1,
      'focus', 'Kaki',
      'exercises', jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Squat dengan Barbell di Bahu',
          'kind', 'C',
          'minSets', 2,
          'maxSets', 3,
          'minReps', 10,
          'maxReps', 12,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Leg Press',
          'kind', 'C',
          'minSets', 2,
          'maxSets', 3,
          'minReps', 10,
          'maxReps', 12,
          'alternatives', jsonb_build_array()
        )
      )
    ),

    -- Hari 4: Glutes
    jsonb_build_object(
      'id', 'glutes-custom-004',
      'name', 'Glutes',
      'day', 4,
      'focus', 'Glutes dan latihan tambahan',
      'exercises', jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Cable Kickback',
          'kind', 'I',
          'minSets', 3,
          'maxSets', 3,
          'minReps', 12,
          'maxReps', 15,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Hip Abduction Machine',
          'kind', 'I',
          'minSets', 3,
          'maxSets', 3,
          'minReps', 12,
          'maxReps', 15,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Sit-Up di Bangku',
          'kind', 'I',
          'minSets', 3,
          'maxSets', 3,
          'minReps', 10,
          'maxReps', 15,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Seated Barbell Shoulder Press',
          'kind', 'C',
          'minSets', 2,
          'maxSets', 3,
          'minReps', 8,
          'maxReps', 12,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Gerakan Dumbbell 5 kg dari Lutut ke Kaki',
          'kind', 'I',
          'minSets', 2,
          'maxSets', 3,
          'minReps', 10,
          'maxReps', 12,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Gerakan Barbell 5 kg dari Lutut ke Kaki',
          'kind', 'C',
          'minSets', 2,
          'maxSets', 3,
          'minReps', 10,
          'maxReps', 12,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Squat dengan Mesin',
          'kind', 'C',
          'minSets', 2,
          'maxSets', 3,
          'minReps', 10,
          'maxReps', 12,
          'alternatives', jsonb_build_array()
        )
      )
    ),

    -- Hari 5: Pinggang/Core
    jsonb_build_object(
      'id', 'core-custom-005',
      'name', 'Pinggang dan Core',
      'day', 5,
      'focus', 'Perut dan core',
      'exercises', jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Cable Crunch',
          'kind', 'I',
          'minSets', 3,
          'maxSets', 3,
          'minReps', 10,
          'maxReps', 15,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Cable Crunch ke Samping',
          'kind', 'I',
          'minSets', 3,
          'maxSets', 3,
          'minReps', 10,
          'maxReps', 12,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Sit-Up dengan Beban 5 kg, Kiri-Kanan',
          'kind', 'I',
          'minSets', 5,
          'maxSets', 5,
          'minReps', 10,
          'maxReps', 10,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Sit-Up',
          'kind', 'I',
          'minSets', 5,
          'maxSets', 5,
          'minReps', 10,
          'maxReps', 10,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Ayunan Badan Terkontrol',
          'kind', 'I',
          'minSets', 4,
          'maxSets', 4,
          'minReps', 10,
          'maxReps', 15,
          'alternatives', jsonb_build_array()
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', 'Sit-Up dengan Kaki Diangkat',
          'kind', 'I',
          'minSets', 4,
          'maxSets', 4,
          'minReps', 10,
          'maxReps', 10,
          'alternatives', jsonb_build_array()
        )
      )
    )
  );

  if exists (
    select 1
    from jsonb_array_elements(current_data->'templates') as existing_template
    join jsonb_array_elements(new_programs) as new_template
      on existing_template->>'id' = new_template->>'id'
  ) then
    raise exception 'Salah satu ID program sudah digunakan. Ganti ID program.';
  end if;

  update public.workout_state
  set data = jsonb_set(
        current_data,
        '{templates}',
        (current_data->'templates') || new_programs
      ),
      revision = revision + 1,
      updated_at = now()
  where user_id = target_user;
end;
$$;