-- ============================================================
-- ClaimDesk — Block C: Schema + RLS + pgvector + Seed
-- Run this ENTIRE file in Supabase: SQL Editor → New query → paste → Run
-- (Seed section at the bottom needs your user UUID — see comments)
-- ============================================================

-- 0. Extensions ------------------------------------------------
create extension if not exists vector;

-- 1. Tables ----------------------------------------------------

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id),
  title text not null,
  client_name text not null,
  claim_type text not null check (claim_type in ('flood','fire','water','wind_hail','denied','underpaid')),
  insurer text,
  policy_number text,
  state text not null check (char_length(state) = 2),
  date_of_loss date,
  amount_offered numeric,
  amount_claimed numeric,
  status text not null default 'intake' check (status in ('intake','investigation','demand','litigation','resolved')),
  is_nfip boolean not null default false,  -- flags federal deadline rules
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  storage_path text not null,
  doc_type text not null check (doc_type in ('policy','denial_letter','estimate','correspondence','other')),
  title text not null,
  page_count int,
  ingest_status text not null default 'pending' check (ingest_status in ('pending','processing','ready','failed')),
  toc_tree jsonb,  -- Tier 2: PageIndex-style section tree lives here
  created_at timestamptz not null default now()
);

create table if not exists chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references documents(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  section_label text,          -- e.g. 'III.B.8 Special Limits'
  page_start int,
  page_end int,
  content text not null,
  embedding vector(1536),      -- text-embedding-3-small = 1536 dims; change if using another model
  created_at timestamptz not null default now()
);

-- similarity search index (HNSW: good default, no training step needed)
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

create table if not exists letters (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  letter_type text not null default 'demand',
  content text not null,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

-- Reference data (not per-user): deadline rules
create table if not exists deadline_rules (
  id bigint generated always as identity primary key,
  jurisdiction text not null,        -- 'FEDERAL-NFIP' or 2-letter state
  claim_basis text not null,         -- what the clock is
  period_months int,                 -- null if not a simple month count
  period_label text not null,        -- human-readable, e.g. '1 year from written denial'
  clock_starts text not null,        -- 'date_of_loss' | 'written_denial'
  description text not null,
  source text not null,
  verified boolean not null default false
);

-- 2. Row Level Security ---------------------------------------
alter table cases enable row level security;
alter table documents enable row level security;
alter table chunks enable row level security;
alter table letters enable row level security;
alter table deadline_rules enable row level security;

create policy "own cases" on cases
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "own documents" on documents
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "own chunks" on chunks
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "own letters" on letters
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());
-- deadline rules are shared read-only reference data
create policy "read deadline rules" on deadline_rules
  for select to authenticated using (true);

-- 3. Similarity search RPC (SECURITY INVOKER: RLS still applies) ----
create or replace function match_chunks(
  query_embedding vector(1536),
  doc_id uuid,
  match_count int default 6,
  min_similarity float default 0.0
)
returns table (
  id bigint,
  section_label text,
  page_start int,
  page_end int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id, c.section_label, c.page_start, c.page_end, c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.document_id = doc_id
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- 4. Private storage bucket + policies -------------------------
insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

create policy "upload own case docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'case-documents' and owner = auth.uid());
create policy "read own case docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'case-documents' and owner = auth.uid());
create policy "delete own case docs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'case-documents' and owner = auth.uid());

-- 5. Seed: deadline rules --------------------------------------
-- NFIP row is verified straight from the policy text (VII.O, p.22).
-- State rows are DEMO placeholders for the portfolio app: plausible,
-- clearly labeled unverified. The UI must show: 'Demo data — verify
-- against current statutes before relying.'
insert into deadline_rules
  (jurisdiction, claim_basis, period_months, period_label, clock_starts, description, source, verified)
values
  ('FEDERAL-NFIP', 'Suit on NFIP flood policy', 12, '1 year from written denial',
   'written_denial',
   'NFIP SFIP Dwelling Form VII.O: suit must be filed within one year after the date of written denial, in the US District Court where the property is located. Federal rule — state statutes of limitation do not control NFIP claims.',
   'SFIP Dwelling Form F-122 (Oct 2021), Section VII.O, p.22', true),
  ('KY', 'Breach of written insurance contract', 120, '~10 years (demo)', 'date_of_loss',
   'Kentucky written-contract limitation period (contracts after 2014 reform). DEMO — verify current KRS before relying.',
   'Kentucky Revised Statutes (verify)', false),
  ('TN', 'Breach of written insurance contract', 72, '~6 years (demo)', 'date_of_loss',
   'Tennessee contract action limitation period. DEMO — verify current TCA before relying.',
   'Tennessee Code Annotated (verify)', false),
  ('IN', 'Breach of written insurance contract', 120, '~10 years (demo)', 'date_of_loss',
   'Indiana written-contract limitation period. DEMO — verify current Indiana Code before relying.',
   'Indiana Code (verify)', false),
  ('FL', 'Property insurance claim', 60, '~5 years (demo; note shorter notice-of-claim deadlines post-2022 reforms)', 'date_of_loss',
   'Florida contract limitation period; recent reforms impose much shorter claim-notice windows. DEMO — verify current Florida Statutes before relying.',
   'Florida Statutes (verify)', false),
  ('TX', 'Property insurance claim', 48, '~4 years (demo; policies often shorten to 2 years + 1 day)', 'date_of_loss',
   'Texas contract limitation period; many policies contractually shorten it. DEMO — verify current Tex. Civ. Prac. & Rem. Code before relying.',
   'Texas statutes (verify)', false),
  ('MT', 'Breach of written insurance contract', 96, '~8 years (demo)', 'date_of_loss',
   'Montana written-contract limitation period. DEMO — verify current MCA before relying.',
   'Montana Code Annotated (verify)', false);

-- 6. Seed: fictional cases -------------------------------------
-- STEP 1: In your app (or Supabase Dashboard → Authentication → Users),
--         create your login user first.
-- STEP 2: Copy that user's UUID and replace the value below.
-- STEP 3: Run this block.
do $$
declare
  uid uuid := 'PASTE-YOUR-USER-UUID-HERE';  -- <<< REPLACE ME
begin
  insert into cases (created_by, title, client_name, claim_type, insurer, policy_number, state, date_of_loss, amount_offered, amount_claimed, status, is_nfip) values
  (uid, 'Alvarez v. Shield Mutual — Flood Underpayment', 'Maria Alvarez', 'flood', 'Shield Mutual', 'SM-FL-448291', 'KY', '2026-01-12', 9000, 42000, 'demand', true),
  (uid, 'Okafor Hail Damage — Roof Denial', 'Daniel Okafor', 'wind_hail', 'Granite State P&C', 'GS-TX-102284', 'TX', '2025-11-03', 0, 28500, 'investigation', false),
  (uid, 'Nguyen Hurricane Claim — Partial Denial', 'Linh Nguyen', 'denied', 'Coastal Assurance Co.', 'CA-FL-771532', 'FL', '2025-09-28', 15000, 96000, 'demand', false),
  (uid, 'Baker Creek Water Loss', 'Thomas Baker', 'water', 'Heartland Mutual', 'HM-TN-334019', 'TN', '2026-03-02', 4200, 18700, 'intake', false),
  (uid, 'Whitefish Wind Damage — Underpaid', 'Sarah Runningwater', 'wind_hail', 'Big Sky Insurance', 'BS-MT-559840', 'MT', '2025-12-19', 11000, 47300, 'litigation', false);
end $$;
