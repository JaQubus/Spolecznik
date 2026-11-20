-- Wyszukiwanie bez embeddingów: cały AI idzie przez Groq, a Groq nie ma modeli embeddingów.
-- Słowa kluczowe w formie podstawowej generuje LLM po obu stronach (przy indeksowaniu i przy zapytaniu),
-- pełnotekstowe 'simple' działa wtedy na lematach, a znaczenie ocenia rerank / radar LLM.

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

-- „Podobne inicjatywy w regionie” — zwraca tylko gminę i podobieństwo; treść nieopublikowanych
-- zgłoszeń nie wychodzi do użytkownika (aplikacja dociąga szczegóły tylko dla opublikowanych).
create or replace function similar_initiatives_kw(p_keywords text[], p_min_similarity float default 0.5, p_limit int default 50)
returns table (initiative_id uuid, teryt text, municipality text, similarity float)
language sql stable as $$
  select k.ref_id, k.teryt, m.name, k.similarity
  from keyword_search('initiative', p_keywords, p_limit) k
  left join municipalities m on m.teryt = k.teryt
  where k.similarity >= p_min_similarity;
$$;
