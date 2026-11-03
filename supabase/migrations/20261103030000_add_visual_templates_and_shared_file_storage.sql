-- Add the visual-notes content type and private storage for materials shared with students.

alter table public.prompt_templates
  drop constraint if exists prompt_templates_template_type_check;

alter table public.prompt_templates
  add constraint prompt_templates_template_type_check
  check (template_type in ('lesson_plan', 'quiz', 'ppt_outline', 'word_brief', 'visual_notes', 'research_paper'));

insert into public.prompt_templates (name, template_type, system_prompt, variables)
select
  'Visual Notes & Diagrams',
  'visual_notes',
  'Create learner-friendly visual notes with concise explanations and multiple readable text diagrams. Include at least two diagrams when the topic supports them: a labeled flow diagram, concept map, timeline, comparison table, or cause-and-effect map. Use simple aligned boxes and arrows that remain readable in plain text and exports. Add a brief legend and cite factual claims from supplied sources.',
  '["topic","audience","diagram_focus","language"]'::jsonb
where not exists (
  select 1 from public.prompt_templates where template_type = 'visual_notes'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-materials', 'shared-materials', false, 26214400, null)
on conflict (id) do update
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = null;

-- Shared-material row security: students see only materials shared with everyone
-- (empty student_ids) or explicitly with them; uploads may reference only the owner's own folder.
alter table public.shared_materials alter column student_ids set default '[]'::jsonb;
update public.shared_materials set student_ids = '[]'::jsonb where student_ids is null or jsonb_typeof(student_ids) <> 'array';
alter table public.shared_materials alter column student_ids set not null;
alter table public.shared_materials drop constraint if exists shared_materials_student_ids_array;
alter table public.shared_materials add constraint shared_materials_student_ids_array check (jsonb_typeof(student_ids) = 'array');

create or replace function public.can_read_shared_material(material public.shared_materials)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    material.professor_id = auth.uid()
    or public.is_admin()
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
      and (jsonb_array_length(material.student_ids) = 0 or material.student_ids ? auth.uid()::text)
    );
$$;
revoke all on function public.can_read_shared_material(public.shared_materials) from public, anon;
grant execute on function public.can_read_shared_material(public.shared_materials) to authenticated;

drop policy if exists "select_materials" on public.shared_materials;
create policy "select_materials" on public.shared_materials
  for select to authenticated
  using (public.can_read_shared_material(shared_materials));

drop policy if exists "insert_materials" on public.shared_materials;
create policy "insert_materials" on public.shared_materials
  for insert to authenticated
  with check (
    professor_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin'))
    and (file_url is null or file_url ~* '^https://' or split_part(file_url, '/', 1) = auth.uid()::text)
  );

drop policy if exists "update_materials" on public.shared_materials;
create policy "update_materials" on public.shared_materials
  for update to authenticated
  using (professor_id = auth.uid())
  with check (
    professor_id = auth.uid()
    and (file_url is null or file_url ~* '^https://' or split_part(file_url, '/', 1) = auth.uid()::text)
  );

-- Templates: only the author (or an admin) may change or remove a saved template.
drop policy if exists "update_templates" on public.prompt_templates;
create policy "update_templates" on public.prompt_templates
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "delete_templates" on public.prompt_templates;
create policy "delete_templates" on public.prompt_templates
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- Private bucket storage policies. No UPDATE policy exists, so stored objects cannot be overwritten.
revoke update on storage.objects from anon;
grant select, insert, delete on storage.objects to authenticated;

drop policy if exists shared_material_upload_owner on storage.objects;
create policy shared_material_upload_owner on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shared-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('professor', 'admin')
    )
  );

drop policy if exists shared_material_read_authorized on storage.objects;
create policy shared_material_read_authorized on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shared-materials'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.shared_materials m
        where m.file_url = storage.objects.name
          and split_part(m.file_url, '/', 1) = m.professor_id::text
          and public.can_read_shared_material(m)
      )
    )
  );

drop policy if exists shared_material_delete_owner on storage.objects;
create policy shared_material_delete_owner on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shared-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('professor', 'admin')
    )
  );

-- Verification (run separately):
-- select id, public, file_size_limit from storage.buckets where id = 'shared-materials';  -- expect public = false, 26214400
-- select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'shared_material%';
-- select policyname, cmd from pg_policies where tablename = 'shared_materials';
