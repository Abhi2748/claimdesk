import type { TocTree } from "@/types/toc";

export type ClaimType =
  | "flood"
  | "fire"
  | "water"
  | "wind_hail"
  | "denied"
  | "underpaid";

export type CaseStatus =
  | "intake"
  | "investigation"
  | "demand"
  | "litigation"
  | "resolved";

export type DocType =
  | "policy"
  | "denial_letter"
  | "estimate"
  | "correspondence"
  | "other";

export type IngestStatus = "pending" | "processing" | "ready" | "failed";

export interface IngestStats {
  chunk_count: number;
  labeled_ratio: number;
  pages_detected: number;
  total_pages: number;
}

export type ClockStarts = "date_of_loss" | "written_denial";

export interface Case {
  id: string;
  created_by: string;
  title: string;
  client_name: string;
  claim_type: ClaimType;
  insurer: string | null;
  policy_number: string | null;
  state: string;
  date_of_loss: string | null;
  amount_offered: number | null;
  amount_claimed: number | null;
  status: CaseStatus;
  is_nfip: boolean;
  created_at: string;
}

export type ReviewKind = "qa_answer" | "letter" | "coverage_analysis";
export type ReviewStatus = "pending" | "approved" | "rejected";
export interface ReviewItem {
  id: string;
  org_id: string;
  case_id: string | null;
  kind: ReviewKind;
  ref_id: string | null;
  title: string;
  summary: string | null;
  status: ReviewStatus;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  case_id: string;
  created_by: string;
  storage_path: string;
  doc_type: DocType;
  title: string;
  page_count: number | null;
  ingest_status: IngestStatus;
  toc_tree: TocTree | null;
  ingest_stats: IngestStats | null;
  created_at: string;
}

export interface Chunk {
  id: number;
  document_id: string;
  created_by: string;
  section_label: string | null;
  page_start: number | null;
  page_end: number | null;
  content: string;
  embedding: string | null;
  created_at: string;
}

export interface Letter {
  id: string;
  case_id: string;
  created_by: string;
  letter_type: string;
  content: string;
  model: string | null;
  prompt_version: string | null;
  planned_queries: string[] | null;
  created_at: string;
}

export interface DeadlineRule {
  id: number;
  jurisdiction: string;
  claim_basis: string;
  period_months: number | null;
  period_label: string;
  clock_starts: ClockStarts;
  description: string;
  source: string;
  verified: boolean;
}

export interface MatchChunkResult {
  id: number;
  section_label: string | null;
  page_start: number | null;
  page_end: number | null;
  content: string;
  similarity: number;
}

export interface Database {
  public: {
    Tables: {
      cases: {
        Row: Case;
        Insert: {
          id?: string;
          created_by?: string;
          title: string;
          client_name: string;
          claim_type: ClaimType;
          insurer?: string | null;
          policy_number?: string | null;
          state: string;
          date_of_loss?: string | null;
          amount_offered?: number | null;
          amount_claimed?: number | null;
          status?: CaseStatus;
          is_nfip?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          created_by?: string;
          title?: string;
          client_name?: string;
          claim_type?: ClaimType;
          insurer?: string | null;
          policy_number?: string | null;
          state?: string;
          date_of_loss?: string | null;
          amount_offered?: number | null;
          amount_claimed?: number | null;
          status?: CaseStatus;
          is_nfip?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: Document;
        Insert: {
          id?: string;
          case_id: string;
          created_by?: string;
          storage_path: string;
          doc_type: DocType;
          title: string;
          page_count?: number | null;
          ingest_status?: IngestStatus;
          toc_tree?: TocTree | null;
          ingest_stats?: IngestStats | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          created_by?: string;
          storage_path?: string;
          doc_type?: DocType;
          title?: string;
          page_count?: number | null;
          ingest_status?: IngestStatus;
          toc_tree?: TocTree | null;
          ingest_stats?: IngestStats | null;
          created_at?: string;
        };
        Relationships: [];
      };
      chunks: {
        Row: Chunk;
        Insert: {
          id?: never;
          document_id: string;
          created_by?: string;
          section_label?: string | null;
          page_start?: number | null;
          page_end?: number | null;
          content: string;
          embedding?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          document_id?: string;
          created_by?: string;
          section_label?: string | null;
          page_start?: number | null;
          page_end?: number | null;
          content?: string;
          embedding?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      letters: {
        Row: Letter;
        Insert: {
          id?: string;
          case_id: string;
          created_by?: string;
          letter_type?: string;
          content: string;
          model?: string | null;
          prompt_version?: string | null;
          planned_queries?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          created_by?: string;
          letter_type?: string;
          content?: string;
          model?: string | null;
          prompt_version?: string | null;
          planned_queries?: string[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      review_items: {
        Row: ReviewItem;
        Insert: {
          id?: string;
          org_id?: string;
          case_id?: string | null;
          kind: ReviewKind;
          ref_id?: string | null;
          title: string;
          summary?: string | null;
          status?: ReviewStatus;
          created_by?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
        };
        Update: {
          status?: ReviewStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
        };
        Relationships: [];
      };
      deadline_rules: {
        Row: DeadlineRule;
        Insert: {
          id?: never;
          jurisdiction: string;
          claim_basis: string;
          period_months?: number | null;
          period_label: string;
          clock_starts: ClockStarts;
          description: string;
          source: string;
          verified?: boolean;
        };
        Update: {
          id?: never;
          jurisdiction?: string;
          claim_basis?: string;
          period_months?: number | null;
          period_label?: string;
          clock_starts?: ClockStarts;
          description?: string;
          source?: string;
          verified?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: string;
          doc_id: string;
          match_count?: number;
          min_similarity?: number;
        };
        Returns: MatchChunkResult[];
      };
      match_chunks_multi: {
        Args: {
          query_embedding: string;
          doc_ids: string[];
          match_count?: number;
          min_similarity?: number;
        };
        Returns: (MatchChunkResult & { document_id: string })[];
      };
      demo_rate_limit_check: {
        Args: {
          p_ip: string;
          p_max: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
    };
  };
}
