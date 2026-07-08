export type DraftDemandLetterResult =
  | {
      ok: true;
      letterId: string;
      content: string;
      hadPolicyPassages: boolean;
      queryCount: number;
      passageCount: number;
      plannedQueries: string[] | null;
    }
  | { ok: false; error: string };

export type SaveLetterResult =
  | { ok: true }
  | { ok: false; error: string };
