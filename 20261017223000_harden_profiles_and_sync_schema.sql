-- Review this migration before applying it to the active Supabase project.
-- It aligns profile authorization with the catalog inspection and ensures
-- signup-created Auth users receive a profile without a client-side INSERT.

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
  department,
  teaching_level,
  teaching_style,
  primary_goal,
  onboarding_completed,
  training_opt_in
) on table public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, full_name, department, role, updated_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'institution', ''),
    'student',
    now()
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

insert into public.profiles (id, email, full_name, department, role, updated_at)
select
  users.id,
  users.email,
  coalesce(nullif(users.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(users.email, ''), '@', 1)),
  nullif(users.raw_user_meta_data ->> 'institution', ''),
  'student',
  now()
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;

-- The supplied inspection confirms these tables are not covered by the
-- intended anonymous-user workflows. RLS remains the authenticated boundary.
revoke all privileges on table
  public.courses,
  public.course_enrollments,
  public.course_materials,
  public.generated_content,
  public.generated_files,
  public.generated_prompts,
  public.professor_documents,
  public.quizzes,
  public.student_alarms,
  public.usage_logs,
  public.usage_telemetry
from anon;
