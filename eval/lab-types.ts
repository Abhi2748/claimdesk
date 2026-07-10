import type { NavStep } from "../lib/qa/types";
import type { EvalStatus } from "./scoring";

export interface LabCitation {
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
}

export interface LabStrategyResult {
  answer: string;
  refused: boolean;
  status: EvalStatus;
  notes: string;
  latencyMs: number;
  topSimilarity: number | null;
  navigationPath: NavStep[];
  navigationBreadcrumb: string;
  citations: LabCitation[];
}

export interface LabQuestionRow {
  id: number;
  difficulty: string;
  question: string;
  trap_notes?: string;
  must_cite: string[];
  must_refuse: boolean;
  vector: LabStrategyResult;
  tree: LabStrategyResult;
}

export interface LabScoreboardRow {
  passRate: number;
  trapCatchRate: number;
  severeCount: number;
  medianLatencyMs: number;
  passCount: number;
  totalCount: number;
}

export interface LabData {
  generatedAt: string;
  documentId: string;
  documentTitle: string;
  questions: LabQuestionRow[];
  scoreboard: {
    vector: LabScoreboardRow;
    tree: LabScoreboardRow;
    oracle_hybrid: LabScoreboardRow;
  };
}
