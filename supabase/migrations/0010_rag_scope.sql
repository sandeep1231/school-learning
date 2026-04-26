-- 0010_rag_scope.sql
-- Phase 5: Scope-based RAG retrieval.
--
-- A single pair of RPCs (vector + FTS) that accept the full Board → Class →
-- Subject → Chapter → Topic hierarchy as optional filters. Replaces the
-- subject-specific and topic-specific RPCs once callers migrate.
--
-- Idempotent.

create or replace function match_chunks_by_scope(
  query_embedding    vector(768),
  target_board       text default null,
  target_class_level smallint default null,
  target_subject_code text default null,
  target_chapter_id  uuid default null,
  target_topic_id    uuid default null,
  include_neighbours boolean default true,
  match_count        int default 12,
  filter_language    app_language default null
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
  left join subjects s on s.id = d.subject_id
  where c.embedding is not null
    and (filter_language is null or c.language = filter_language)
    and (target_board is null or s.board = target_board)
    and (target_class_level is null or s.class_level = target_class_level)
    and (target_subject_code is null or s.code = target_subject_code)
    and (
      target_topic_id is null
      or c.topic_id = target_topic_id
      or (include_neighbours and c.chapter_id = (
        select chapter_id from topics where id = target_topic_id
      ))
    )
    and (
      target_chapter_id is null
      or c.chapter_id = target_chapter_id
    )
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_chunks_fts_by_scope(
  query_text         text,
  target_board       text default null,
  target_class_level smallint default null,
  target_subject_code text default null,
  target_chapter_id  uuid default null,
  target_topic_id    uuid default null,
  include_neighbours boolean default true,
  match_count        int default 12,
  filter_language    app_language default null
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
  left join subjects s on s.id = d.subject_id
  cross join q
  where c.tsv @@ q.tsq
    and (filter_language is null or c.language = filter_language)
    and (target_board is null or s.board = target_board)
    and (target_class_level is null or s.class_level = target_class_level)
    and (target_subject_code is null or s.code = target_subject_code)
    and (
      target_topic_id is null
      or c.topic_id = target_topic_id
      or (include_neighbours and c.chapter_id = (
        select chapter_id from topics where id = target_topic_id
      ))
    )
    and (
      target_chapter_id is null
      or c.chapter_id = target_chapter_id
    )
  order by rank desc
  limit match_count;
$$;

grant execute on function match_chunks_by_scope(
  vector, text, smallint, text, uuid, uuid, boolean, int, app_language
) to authenticated, service_role, anon;

grant execute on function match_chunks_fts_by_scope(
  text, text, smallint, text, uuid, uuid, boolean, int, app_language
) to authenticated, service_role, anon;
