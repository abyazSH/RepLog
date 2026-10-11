-- Existing projects: run in Supabase SQL Editor before deploying custom programs.
-- Allows an empty program list while preserving account ownership and revision checks.
begin;
create or replace function public.replog_save_state(expected_revision integer,new_data jsonb) returns integer
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
 if jsonb_array_length(new_data->'templates') not between 0 and 20
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
