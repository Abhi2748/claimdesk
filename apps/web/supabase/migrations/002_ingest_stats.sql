-- Add ingestion quality stats to documents (populated after processing completes)
alter table documents
  add column if not exists ingest_stats jsonb;
