-- Jalankan sebagai postgres melalui Supabase SQL Editor, bukan browser/client.
-- Ekspor cadangan dari RepLog, tunggu autosave selesai, lalu tutup semua tab RepLog.
-- GANTI email, dua tanggal Rabu, dan zona waktu di bawah sebelum menjalankan.
-- Contoh tanggal: Rabu minggu 6 November 2026 dan Rabu minggu sebelumnya.
-- Hanya sesi selesai bernama Leg Day / Legs yang diperbarui; tidak membuat sesi baru.
-- Jika Hip Adduction sudah ada, SELURUH set gerakan itu diganti menjadi 3 x 12 x 30 kg.
-- Jika belum ada, hanya gerakan Hip Adduction yang ditambahkan pada sesi tersebut.
-- Program, gerakan lain, tanggal sesi, catatan, draft, dan berat badan tidak diubah.

do $$
declare
  target_email text := 'GANTI_EMAIL_AKUN_REPLOG';
  target_dates date[] := array[date '2026-11-04', date '2026-10-28'];
  local_timezone text := 'Asia/Jakarta'; -- Ganti jika bukan WIB.
  target_user uuid;
  current_data jsonb;
  target_date date;
  session_index integer;
  matches integer;
  workout jsonb;
  entries jsonb;
  new_exercise jsonb;
  new_sets constant jsonb := '[{"kg":"30","reps":"12","done":true},{"kg":"30","reps":"12","done":true},{"kg":"30","reps":"12","done":true}]';
begin
  if target_email = 'GANTI_EMAIL_AKUN_REPLOG' then
    raise exception 'Isi target_email dengan email akun RepLog terlebih dahulu.';
  end if;
  if cardinality(target_dates) <> 2
     or target_dates[1] is null or target_dates[2] is null
     or target_dates[1] = target_dates[2]
     or extract(isodow from target_dates[1]) <> 3
     or extract(isodow from target_dates[2]) <> 3 then
    raise exception 'Isi dua tanggal Rabu yang berbeda.';
  end if;

  begin
    select id into strict target_user from auth.users
    where lower(email) = lower(trim(target_email));
  exception
    when no_data_found then
      raise exception 'Akun dengan email % tidak ditemukan di project Supabase ini. Gunakan email login RepLog, bukan email dashboard Supabase.', target_email;
    when too_many_rows then
      raise exception 'Lebih dari satu akun cocok dengan email %. Periksa Authentication > Users.', target_email;
  end;
  begin
    select data into strict current_data from public.workout_state
    where user_id = target_user for update;
  exception when no_data_found then
    raise exception 'Akun % ditemukan, tetapi belum memiliki workout_state. Periksa akun dan project yang digunakan untuk menyimpan latihan.', target_email;
  end;

  foreach target_date in array target_dates loop
    select count(*), min((position - 1)::integer)
    into matches, session_index
    from jsonb_array_elements(current_data->'sessions') with ordinality as s(value, position)
    where value->>'finished' = 'true'
      and regexp_replace(lower(value->>'name'), '[[:space:]]+', '', 'g') in ('legday', 'legs')
      and ((value->>'date')::timestamptz at time zone local_timezone)::date = target_date;

    if matches <> 1 then
      raise exception 'Tanggal %: ditemukan % sesi Leg Day/Legs selesai, harus tepat 1. Tidak ada perubahan disimpan.', target_date, matches;
    end if;
    workout := current_data->'sessions'->session_index;
    if current_data->'draft'->>'id' = workout->>'id' then
      raise exception 'Sesi % sedang diedit sebagai draft. Selesaikan atau batalkan edit terlebih dahulu.', target_date;
    end if;

    select count(*) into matches from jsonb_array_elements(workout->'exercises') as e(value)
    where lower(trim(value->'exercise'->>'name')) = 'hip adduction';
    if matches > 1 then
      raise exception 'Ada Hip Adduction duplikat pada %. Tidak ada perubahan disimpan.', target_date;
    end if;
    if exists (
      select 1 from jsonb_array_elements(workout->'exercises') as e(value)
      where lower(trim(value->'exercise'->>'name')) = 'hip adduction'
        and coalesce(value->'exercise'->>'tracking', 'strength') <> 'strength'
    ) then
      raise exception 'Hip Adduction pada % bukan gerakan beban.', target_date;
    end if;

    if matches = 1 then
      select jsonb_agg(case
        when lower(trim(value->'exercise'->>'name')) = 'hip adduction'
          then jsonb_set(value, '{sets}', new_sets)
        else value end order by position)
      into entries
      from jsonb_array_elements(workout->'exercises') with ordinality as e(value, position);
    else
      if jsonb_array_length(workout->'exercises') >= 30 then
        raise exception 'Batas 30 gerakan tercapai pada %.', target_date;
      end if;
      new_exercise := jsonb_build_object(
        'id', 'hip-adduction-history', 'name', 'Hip Adduction', 'kind', 'I',
        'minSets', 3, 'maxSets', 3, 'minReps', 12, 'maxReps', 12,
        'alternatives', '[]'::jsonb
      );
      entries := (workout->'exercises') || jsonb_build_array(
        jsonb_build_object('exercise', new_exercise, 'sets', new_sets)
      );
    end if;
    current_data := jsonb_set(current_data,
      array['sessions', session_index::text, 'exercises'], entries);
  end loop;

  update public.workout_state
  set data = current_data, revision = revision + 1, updated_at = now()
  where user_id = target_user;
  raise notice 'Hip Adduction diperbarui: 3 set x 12 repetisi x 30 kg, tanggal %.', target_dates;
end;
$$;

-- Setelah berhasil, buka ulang / refresh RepLog agar revision terbaru dimuat.
