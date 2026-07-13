-- Matter-scoped retrieval across many documents. Mirrors match_chunks exactly,
-- adds document_id to the result and takes an array of doc ids. SECURITY INVOKER
-- (default) so chunks RLS still applies. The single-doc match_chunks is untouched.
create or replace function match_chunks_multi(
  query_embedding vector(1536),
  doc_ids uuid[],
  match_count int default 6,
  min_similarity float default 0.0
)
returns table (
  id bigint, document_id uuid, section_label text,
  page_start int, page_end int, content text, similarity float
)
language sql stable
as $$
  select c.id, c.document_id, c.section_label, c.page_start, c.page_end, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.document_id = any(doc_ids)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
notify pgrst, 'reload schema';
