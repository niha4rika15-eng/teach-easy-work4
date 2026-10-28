-- Teach Easy RAG, evaluation, and storage additions.
-- Review and apply manually. This migration is intentionally not executed by the app.

create extension if not exists vector with schema extensions;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.professor_documents(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) between 1 and 20000),
  embedding extensions.vector(1536),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.generation_evaluations (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generated_content(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  evaluator text not null,
  nep_compliance_score integer check (nep_compliance_score between 0 and 100),
  hallucination_score integer check (hallucination_score between 0 and 100),
  quality_score integer check (quality_score between 0 and 100),
  citations jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (generation_id, evaluator)
);

create index if not exists document_chunks_document_idx on public.document_chunks(document_id, chunk_index);
create index if not exists document_chunks_course_idx on public.document_chunks(course_id) where course_id is not null;
create index if not exists document_chunks_embedding_hnsw_idx on public.document_chunks using hnsw (embedding vector_cosine_ops) where embedding is not null;
create index if not exists generation_evaluations_generation_idx on public.generation_evaluations(generation_id);

create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  requested_course_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  professor_id uuid,
  course_id uuid,
  chunk_index integer,
  content text,
  source_metadata jsonb,
  similarity real
)
language sql stable security invoker
set search_path = public, extensions
as $$
  select c.id, c.document_id, c.professor_id, c.course_id, c.chunk_index,
         c.content, c.source_metadata,
         (1 - (c.embedding <=> query_embedding))::real as similarity
  from public.document_chunks c
  where c.embedding is not null
    and (requested_course_id is null or c.course_id = requested_course_id)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 50));
$$;

alter table public.document_chunks enable row level security;
alter table public.generation_evaluations enable row level security;

drop policy if exists document_chunks_professor_manage on public.document_chunks;
create policy document_chunks_professor_manage on public.document_chunks
  for all to authenticated
  using (auth.uid() = professor_id)
  with check (auth.uid() = professor_id);

drop policy if exists document_chunks_student_shared_course on public.document_chunks;
create policy document_chunks_student_shared_course on public.document_chunks
  for select to authenticated
  using (
    exists (
      select 1 from public.professor_documents d
      where d.id = document_chunks.document_id
        and d.is_shared_with_students = true
        and (
          d.course_id is null or exists (
            select 1 from public.course_enrollments e
            where e.course_id = d.course_id and e.student_id = auth.uid()
          )
        )
    )
  );

drop policy if exists generation_evaluations_owner_read on public.generation_evaluations;
create policy generation_evaluations_owner_read on public.generation_evaluations
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists generation_evaluations_owner_insert on public.generation_evaluations;
create policy generation_evaluations_owner_insert on public.generation_evaluations
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Storage was confirmed empty. The bucket is private and policies are scoped to
-- the authenticated professor path: <professor UUID>/<filename>.
insert into storage.buckets (id, name, public)
values ('professor-documents', 'professor-documents', false)
on conflict (id) do nothing;

drop policy if exists professor_documents_storage_select on storage.objects;
create policy professor_documents_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'professor-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists professor_documents_storage_insert on storage.objects;
create policy professor_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'professor-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists professor_documents_storage_update on storage.objects;
create policy professor_documents_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'professor-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'professor-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists professor_documents_storage_delete on storage.objects;
create policy professor_documents_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'professor-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Verification queries (run separately after review/apply):
-- select extname from pg_extension where extname = 'vector';
-- select to_regclass('public.document_chunks'), to_regclass('public.generation_evaluations');
-- select indexname from pg_indexes where indexname in ('document_chunks_embedding_hnsw_idx','document_chunks_document_idx');
-- select proname from pg_proc where proname = 'match_document_chunks';
-- select id, name, public from storage.buckets where id = 'professor-documents';
-- select tablename, policyname from pg_policies where tablename in ('document_chunks','generation_evaluations');
