-- Run once in the SQL Editor of a NEW Supabase project.
begin;
create schema if not exists replog_private;
revoke all on schema replog_private from public, anon, authenticated;
create table replog_private.allowed_emails (
 email text primary key check (email = lower(trim(email)) and position('@' in email)>1)
);
alter table replog_private.allowed_emails enable row level security;
revoke all on replog_private.allowed_emails from public, anon, authenticated;
create function public.replog_is_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from auth.users u
  join replog_private.allowed_emails a on a.email=lower(u.email)
  where u.id=(select auth.uid()) and u.email_confirmed_at is not null
  and exists (select 1 from auth.identities i where i.user_id=u.id and i.provider='google'
    and i.identity_data->>'email_verified'='true'
    and lower(i.identity_data->>'email')=lower(u.email))
 );
$$;
revoke all on function public.replog_is_allowed() from public,anon;
grant execute on function public.replog_is_allowed() to authenticated;
create table public.workout_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision integer not null check(revision>0),
 data jsonb not null check (jsonb_typeof(data)='object' and octet_length(data::text)<=2000000),
 updated_at timestamptz not null default now()
);
alter table public.workout_state enable row level security;
revoke all on public.workout_state from public,anon,authenticated;
grant select on public.workout_state to authenticated;
create policy read_own_state on public.workout_state for select to authenticated
using (user_id=(select auth.uid()) and (select public.replog_is_allowed()));
-- No direct writes and no client-supplied owner. Atomic revision checking.
create function public.replog_save_state(expected_revision integer,new_data jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); next_revision integer;
begin
 if actor is null or not public.replog_is_allowed() then
  raise exception 'Account not allowed' using errcode='42501';
 end if;
 if expected_revision is null or expected_revision<0 or expected_revision>=2147483647
 or new_data is null or jsonb_typeof(new_data) is distinct from 'object'
 or not (new_data ?& array['templates','sessions','draft','weights'])
 or jsonb_typeof(new_data->'templates') is distinct from 'array'
 or jsonb_typeof(new_data->'sessions') is distinct from 'array'
 or jsonb_typeof(new_data->'weights') is distinct from 'array'
 or jsonb_typeof(new_data->'draft') not in ('null','object')
 or octet_length(new_data::text)>2000000 then
  raise exception 'Invalid state' using errcode='22023';
 end if;
 if jsonb_array_length(new_data->'templates') not between 1 and 20
 or jsonb_array_length(new_data->'sessions')>2000
 or jsonb_array_length(new_data->'weights')>3000 then
  raise exception 'State exceeds limits' using errcode='22023';
 end if;
 if expected_revision=0 then
  insert into public.workout_state(user_id,revision,data) values(actor,1,new_data)
  on conflict(user_id) do nothing returning revision into next_revision;
 else
  update public.workout_state set data=new_data,revision=revision+1,updated_at=now()
  where user_id=actor and revision=expected_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception 'Revision conflict' using errcode='40001';end if;
 return next_revision;
end;
$$;
revoke all on function public.replog_save_state(integer,jsonb) from public,anon;
grant execute on function public.replog_save_state(integer,jsonb) to authenticated;
commit;
