-- Professor-owned document ingestion and semantic retrieval.
-- Apply only after reviewing the active Supabase migration history.

create extension if not exists vector with schema extensions;

alter table public.generations
  add column if not exists source_citations jsonb not null default '[]'::jsonb;

create table if not exists public.professor_documents (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  mime_type text not null,
  byte_size bigint not null check (byte_size between 1 and 4194304),
  character_count integer not null default 0 check (character_count between 0 and 200000),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  content_hash text not null,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.professor_documents(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) between 1 and 20000),
  embedding extensions.vector(1536) not null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.generation_evaluations (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
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

create index if not exists professor_documents_owner_idx
  on public.professor_documents(professor_id, created_at desc);
create index if not exists document_chunks_document_idx
  on public.document_chunks(document_id, chunk_index);
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists generation_evaluations_generation_idx
  on public.generation_evaluations(generation_id);

alter table public.professor_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.generation_evaluations enable row level security;

drop policy if exists professor_documents_owner_select on public.professor_documents;
create policy professor_documents_owner_select on public.professor_documents
  for select to authenticated using (
    auth.uid() = professor_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin'))
  );

drop policy if exists professor_documents_owner_insert on public.professor_documents;
create policy professor_documents_owner_insert on public.professor_documents
  for insert to authenticated with check (
    auth.uid() = professor_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin'))
  );

drop policy if exists professor_documents_owner_update on public.professor_documents;
create policy professor_documents_owner_update on public.professor_documents
  for update to authenticated
  using (auth.uid() = professor_id and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin')
  ))
  with check (auth.uid() = professor_id and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin')
  ));

drop policy if exists professor_documents_owner_delete on public.professor_documents;
create policy professor_documents_owner_delete on public.professor_documents
  for delete to authenticated using (
    auth.uid() = professor_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin'))
  );

drop policy if exists document_chunks_owner_manage on public.document_chunks;
create policy document_chunks_owner_manage on public.document_chunks
  for all to authenticated
  using (
    auth.uid() = professor_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin'))
  )
  with check (
    auth.uid() = professor_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin'))
    and exists (
      select 1 from public.professor_documents d
      where d.id = document_id and d.professor_id = auth.uid()
    )
  );

drop policy if exists generation_evaluations_owner_read on public.generation_evaluations;
create policy generation_evaluations_owner_read on public.generation_evaluations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists generation_evaluations_owner_insert on public.generation_evaluations;
create policy generation_evaluations_owner_insert on public.generation_evaluations
  for insert to authenticated with check (auth.uid() = user_id);

revoke all on public.professor_documents, public.document_chunks, public.generation_evaluations from public, anon;
grant select, insert, update, delete on public.professor_documents to authenticated;
grant select, insert, update, delete on public.document_chunks to authenticated;
grant select, insert on public.generation_evaluations to authenticated;

create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  chunk_index integer,
  content text,
  source_metadata jsonb,
  similarity real
)
language sql
stable
security invoker
set hnsw.ef_search = 100
set search_path = public, extensions
as $$
  select c.id,
         c.document_id,
         d.title,
         c.chunk_index,
         c.content,
         c.source_metadata,
         (1 - (c.embedding <=> query_embedding))::real as similarity
  from public.document_chunks c
  join public.professor_documents d on d.id = c.document_id
  where c.embedding is not null
    and d.status = 'ready'
    and c.professor_id = auth.uid()
    and d.professor_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('professor', 'admin'))
  order by c.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 20));
$$;

revoke all on function public.match_document_chunks(extensions.vector, integer) from public, anon;
grant execute on function public.match_document_chunks(extensions.vector, integer) to authenticated;

-- Verification queries (run separately after applying):
-- select extname from pg_extension where extname = 'vector';
-- select to_regclass('public.professor_documents'), to_regclass('public.document_chunks');
-- select indexname from pg_indexes where indexname = 'document_chunks_embedding_hnsw_idx';
-- select proname from pg_proc where proname = 'match_document_chunks';
-- select tablename, policyname from pg_policies where tablename in ('professor_documents','document_chunks');
