-- Subject-scoped RAG retrieval. Useful when chunks aren't tagged to a
-- specific topic (typical for bulk-ingested textbook PDFs): we fall back
-- to "anything from this subject's documents".

create or replace function match_chunks_by_subject(
  query_embedding  vector(768),
  target_subject_code text,
  match_count      int default 12,
  filter_language  app_language default null
)
returns table (
  id uuid,
  content text,
  page int,
  topic_id uuid,
  chapter_id uuid,
  document_title text,
  source_url text,
  language app_language,
  similarity float
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.content,
    c.page,
    c.topic_id,
    c.chapter_id,
    d.title as document_title,
    d.source_url,
    c.language,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  join subjects s  on s.id = d.subject_id
  where c.embedding is not null
    and s.code = target_subject_code
    and (filter_language is null or c.language = filter_language)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_chunks_fts_by_subject(
  query_text       text,
  target_subject_code text,
  match_count      int default 12,
  filter_language  app_language default null
)
returns table (
  id uuid,
  content text,
  page int,
  topic_id uuid,
  chapter_id uuid,
  document_title text,
  source_url text,
  language app_language,
  rank float
)
language sql stable security definer set search_path = public as $$
  with q as (select plainto_tsquery('simple', query_text) as tsq)
  select
    c.id,
    c.content,
    c.page,
    c.topic_id,
    c.chapter_id,
    d.title as document_title,
    d.source_url,
    c.language,
    ts_rank(c.tsv, q.tsq) as rank
  from chunks c
  join documents d on d.id = c.document_id
  join subjects s  on s.id = d.subject_id
  cross join q
  where c.tsv @@ q.tsq
    and s.code = target_subject_code
    and (filter_language is null or c.language = filter_language)
  order by rank desc
  limit match_count;
$$;

grant execute on function match_chunks_by_subject(vector, text, int, app_language)
  to authenticated, service_role, anon;
grant execute on function match_chunks_fts_by_subject(text, text, int, app_language)
  to authenticated, service_role, anon;
