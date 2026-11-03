-- Review this migration before applying it to the active Supabase project.
-- It aligns profile authorization with the catalog inspection and ensures
-- signup-created Auth users receive a profile without a client-side INSERT.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Remove every pre-existing profiles policy (including legacy public-read ones) before defining ours.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists profiles_select_policy on public.profiles;
drop policy if exists profiles_insert_policy on public.profiles;
drop policy if exists profiles_update_policy on public.profiles;
drop policy if exists "select_own_profile" on public.profiles;
drop policy if exists "insert_own_profile" on public.profiles;
drop policy if exists "update_own_profile" on public.profiles;

create policy profiles_select_policy on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_policy on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

revoke all privileges on table public.profiles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (
  full_name,
  institution
) on table public.profiles to authenticated;

-- Earlier prototypes may have extra NOT NULL profile columns; relax those so the signup trigger
-- (which writes only id, email, full_name, institution, role) can never fail.
do $$
declare
  col record;
begin
  for col in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and is_nullable = 'NO' and column_default is null
      and column_name not in ('id', 'email', 'full_name', 'role')
  loop
    execute format('alter table public.profiles alter column %I drop not null', col.column_name);
  end loop;
end $$;

update public.profiles set role = lower(role) where role is distinct from lower(role);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'professor', 'student'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, full_name, institution, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'institution', ''),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, institution, role)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(nullif(users.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(users.email, ''), '@', 1)),
  nullif(users.raw_user_meta_data ->> 'institution', ''),
  'student'
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;

-- Revoke anonymous access to tables defined by the supplied base migration.
revoke all privileges on table
  public.prompt_templates,
  public.generations,
  public.quiz_forms,
  public.shared_materials,
  public.notifications,
  public.usage_logs
from anon;

-- Platform administrator account (role is assigned server-side, never from signup metadata).
update public.profiles set role = 'admin' where lower(email) = 'niha4rika15@gmail.com';
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where lower(email) = 'niha4rika15@gmail.com';
