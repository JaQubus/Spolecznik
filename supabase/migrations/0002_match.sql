-- Społecznik·Dopasuj: podobieństwo w wynikach wyszukiwania + podobne potrzeby z innych gmin.

-- hybrid_search zwraca teraz też podobieństwo cosinusowe (0–1), żeby aplikacja mogła
-- odciąć niepowiązanych ekspertów i nabory — sam wynik RRF nie mówi, czy coś w ogóle pasuje.
drop function if exists hybrid_search(text, text, vector, int, int);

create or replace function hybrid_search(
  p_kind text, p_keywords text, p_embedding vector(1536),
  p_count int default 15, p_rrf_k int default 50
) returns table (ref_id uuid, title text, score float, similarity float)
language sql stable as $$
  with kw as (
    select id, row_number() over (
      order by ts_rank_cd(fts, websearch_to_tsquery('simple', p_keywords)) desc) as r
    from search_index
    where kind = p_kind and active
      and fts @@ websearch_to_tsquery('simple', p_keywords)
    order by r limit p_count * 2
  ),
  sem as (
    select id, row_number() over (order by embedding <=> p_embedding) as r
    from search_index
    where kind = p_kind and active and embedding is not null
    order by r limit p_count * 2
  )
  select s.ref_id, s.title,
         (coalesce(1.0 / (p_rrf_k + kw.r), 0) + coalesce(1.0 / (p_rrf_k + sem.r), 0))::float as score,
         coalesce(1 - (s.embedding <=> p_embedding), 0)::float as similarity
  from kw
  full outer join sem on kw.id = sem.id
  join search_index s on s.id = coalesce(kw.id, sem.id)
  order by score desc
  limit p_count;
$$;

-- Potrzeby zgłoszone wcześniej, semantycznie bliskie nowej. Zwraca tylko gminę —
-- treść cudzych zgłoszeń nie wychodzi do użytkownika.
create or replace function similar_needs(
  p_embedding vector(1536), p_min_similarity float default 0.55, p_limit int default 50
) returns table (need_id uuid, teryt text, gmina text, similarity float)
language sql stable as $$
  select s.ref_id, s.teryt, g.nazwa, (1 - (s.embedding <=> p_embedding))::float
  from search_index s
  left join gminy g on g.teryt = s.teryt
  where s.kind = 'potrzeba' and s.active and s.embedding is not null
    and 1 - (s.embedding <=> p_embedding) >= p_min_similarity
  order by s.embedding <=> p_embedding
  limit p_limit;
$$;

-- Wyszukiwanie gminy po nazwie wpisanej przez użytkownika („w Nowym Targu” → intake daje „Nowy Targ”).
create index if not exists gminy_nazwa_lower on gminy (lower(nazwa));
