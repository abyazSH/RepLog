-- Run after 001_replog.sql. Safe to rerun; existing workouts are preserved.
-- Confirmed email/password accounts can register without an invitation.
begin;
alter table replog_private.allowed_emails enable row level security;
create or replace function public.replog_is_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from auth.users u
  where u.id=(select auth.uid()) and u.email_confirmed_at is not null
   and exists (select 1 from auth.identities i where i.user_id=u.id and i.provider='email')
 );
$$;
revoke all on function public.replog_is_allowed() from public,anon;
grant execute on function public.replog_is_allowed() to authenticated;
commit;

