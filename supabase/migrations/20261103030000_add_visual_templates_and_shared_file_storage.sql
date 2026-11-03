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

grant select, insert, delete on storage.objects to authenticated;

drop policy if exists shared_material_upload_owner on storage.objects;
create policy shared_material_upload_owner on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shared-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
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
    and exists (
      select 1
      from public.shared_materials m
      where m.file_url = storage.objects.name
        and (
          m.professor_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('student', 'admin')
          )
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
