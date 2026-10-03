-- Wyszukiwanie bez embeddingów: cały AI idzie przez Groq, a Groq nie ma modeli embeddingów.
-- Dopasowanie po lematach (słowa kluczowe w formie podstawowej z LLM po obu stronach, README 5.3),
-- znaczenie ocenia rerank LLM. Kolumny embedding zostają — puste, na wypadek dostawcy embeddingów.

-- Karty z indeksu, które dzielą słowa kluczowe z zapytaniem.
-- similarity = jaka część słów kluczowych zapytania pasuje do karty (0–1).
create or replace function keyword_search(p_kind text, p_keywords text[], p_count int default 15)
returns table (ref_id uuid, title text, teryt text, score float, similarity float)
language sql stable as $$
  with q as (
    select distinct lower(trim(t.word)) as k
    from unnest(p_keywords) as t(word)
    where trim(t.word) <> ''
  ),
  hits as (
    select s.ref_id, s.title, s.teryt,
           count(*) as matched,
           sum(ts_rank_cd(s.fts, phraseto_tsquery('simple', q.k))) as rank
    from search_index s
    join q on s.fts @@ phraseto_tsquery('simple', q.k)
    where s.kind = p_kind and s.active
    group by s.ref_id, s.title, s.teryt
  )
  select ref_id, title, teryt, rank::float,
         (matched::float / greatest((select count(*) from q), 1))::float
  from hits
  order by matched desc, rank desc
  limit p_count;
$$;

-- „Inne gminy zgłosiły podobny problem” — tylko gmina, treść cudzych zgłoszeń nie wychodzi do użytkownika.
create or replace function similar_needs_kw(p_keywords text[], p_min_similarity float default 0.5, p_limit int default 50)
returns table (need_id uuid, teryt text, gmina text, similarity float)
language sql stable as $$
  select k.ref_id, k.teryt, g.nazwa, k.similarity
  from keyword_search('potrzeba', p_keywords, p_limit) k
  left join gminy g on g.teryt = k.teryt
  where k.similarity >= p_min_similarity;
$$;

-- Zapytaj Bibliotekę: fragmenty raportów nie mają lematów, więc szukamy po prefiksach słów
-- (p_query budowany w aplikacji, np. 'samotno:* | senior:*'), co łapie polskie odmiany.
alter table doc_chunks
  add column if not exists fts tsvector generated always as (to_tsvector('simple', doc_title || ' ' || "text")) stored;
create index if not exists doc_chunks_fts_idx on doc_chunks using gin (fts);

create or replace function search_doc_chunks(p_query text, p_count int default 6)
returns table (id uuid, doc_title text, year int, url text, page int, text text, score float)
language sql stable as $$
  select c.id, c.doc_title, c.year, c.url, c.page, c.text, ts_rank_cd(c.fts, to_tsquery('simple', p_query))::float
  from doc_chunks c
  where c.fts @@ to_tsquery('simple', p_query)
  order by 7 desc
  limit p_count;
$$;
