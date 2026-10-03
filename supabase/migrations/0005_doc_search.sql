-- Zapytaj Bibliotekę (/api/ask): fragmenty raportów najbliższe pytaniu.
create or replace function match_doc_chunks(p_embedding vector(1536), p_count int default 6)
returns table (id uuid, doc_title text, year int, url text, page int, text text, similarity float)
language sql stable as $$
  select c.id, c.doc_title, c.year, c.url, c.page, c.text, (1 - (c.embedding <=> p_embedding))::float
  from doc_chunks c
  where c.embedding is not null
  order by c.embedding <=> p_embedding
  limit p_count;
$$;
