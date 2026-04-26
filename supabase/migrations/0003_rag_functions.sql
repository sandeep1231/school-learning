-- Helper RPCs for hybrid RAG retrieval.
-- Uses SECURITY DEFINER so they can be invoked by the service role or by
-- authenticated users; they respect the topic_id filter passed in.

create or replace function match_chunks_vector(
  query_embedding  vector(768),
  target_topic_id  uuid,
  include_neighbours boolean default true,
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
  with target as (
    select t.id, t.chapter_id from topics t where t.id = target_topic_id
  ),
  candidate_topics as (
    select id from target
    union
    select t2.id from topics t2, target tt
    where include_neighbours and t2.chapter_id = tt.chapter_id
  )
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
  where c.embedding is not null
    and (c.topic_id in (select id from candidate_topics)
         or (c.topic_id is null and c.chapter_id in (select chapter_id from target)))
    and (filter_language is null or c.language = filter_language)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_chunks_fts(
  query_text       text,
  target_topic_id  uuid,
  include_neighbours boolean default true,
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
  with target as (
    select t.id, t.chapter_id from topics t where t.id = target_topic_id
  ),
  candidate_topics as (
    select id from target
    union
    select t2.id from topics t2, target tt
    where include_neighbours and t2.chapter_id = tt.chapter_id
  ),
  q as (select plainto_tsquery('simple', query_text) as tsq)
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
  cross join q
  where c.tsv @@ q.tsq
    and (c.topic_id in (select id from candidate_topics)
         or (c.topic_id is null and c.chapter_id in (select chapter_id from target)))
    and (filter_language is null or c.language = filter_language)
  order by rank desc
  limit match_count;
$$;

grant execute on function match_chunks_vector(vector, uuid, boolean, int, app_language) to authenticated, service_role;
grant execute on function match_chunks_fts(text, uuid, boolean, int, app_language) to authenticated, service_role;
