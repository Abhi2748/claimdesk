# Phase 2 Progress Checklist

Verified against the actual repo state on 2026-07-14 (not just the brief/build log,
which hadn't been updated past Phase 1 / Block 1.5).

## Block 2.1 — Finish the cutover + signup + landing — ✅ DONE
- [x] Multi-doc "Ask the matter" Q&A moved off the Next.js server and onto
      `apps/ai`: `POST /qa/matter` exists (`apps/ai/app/routers/qa.py:68`) and
      `askMatter` (`apps/web/app/cases/[id]/qa-actions.ts`) calls it via
      `askMatterQuestion()` → `AI_BASE_URL`, forwarding the user's JWT. The
      split-brain called out in the brief (eval hits Python, live feature hit
      TypeScript) is closed — both now run the same Python path.
  - Note: `verifyCitations()` still runs client-side in `apps/web` against the
    `retrieved_chunks` the AI service returns — that's correct, it's a pure
    function with nothing to gain from moving.
- [x] Public self-serve signup: `/signup` + `/signup/check-email` pages exist.
- [x] Marketing/landing page: `apps/web/app/page.tsx` (hero, log in / sign up CTAs).

## Block 2.2 — Retrieval Lab v2 (defensible benchmark) — ⏳ IN PROGRESS
- [x] **2.2a — Budgets + multi-doc golden corpus (content only, no retrieval
      code touched).** `docs/decisions/001-retrieval-benchmark-budgets.md` sets
      the latency (p50 ≤ 8s / p95 ≤ 12s) and cost (≤ $0.03/query) targets,
      grounded in the measured F-122 baseline from `eval/results.md` (cost is
      an estimate — flagged for replacement with real Langfuse usage data).
      `eval/golden-f123.json` (13 questions) and `eval/golden-f144.json` (10
      questions, including the RCBAP's own worked coinsurance example as the
      flagship trap) extend the golden corpus alongside the frozen
      `eval/golden.json` (F-122). Not yet wired into `run-eval.ts` or ingested
      into Supabase — that's the next sub-step.
- [x] **2.2b — Ingest F-123/F-144 + multi-doc eval runner.** Both PDFs
      ingested via `scripts/ingest-golden-docs.ts` into the same org/fixture
      case as the frozen F-122 doc: F-123 → `0411ce14-03ee-4841-bd7a-058c94af2ffd`
      (296 chunks, 100% labeled), F-144 → `2e29b25f-d0bf-4f1c-b956-11cd6a8c0d88`
      (306 chunks, 100% labeled). `eval/run-eval.ts` now takes `GOLDEN_FILE`
      (default `golden.json`, unchanged behavior) and resolves non-F-122
      golden files via the new `eval/documents.json` map. F-122 baseline
      reconfirmed **17/20, 0 SEVERE, unchanged**. First uningated look at the
      new corpus: F-123 11/13 PASS/2 SEVERE, F-144 7/10 PASS/3 FAIL — real
      findings recorded in the build log (a chunk-filter false-positive, a
      stale/non-reproducible F-122 chunk set, refusal-string inconsistency,
      3 retrieval-ranking misses), all evidence for the ablation below.
- [x] **2.2c (in progress) — ablation harness built + proven on a small
      sample.** Fresh reproducible F-122 copy ingested (`F-122-ABLATION`,
      314 chunks, today's parser — live F-122 untouched). Harness
      (`eval/retrieval-lab.ts` + `eval/bm25.ts`) measures real accuracy/
      latency/cost per query across configs; dense retrieval always via the
      real `match_chunks_multi` RPC, BM25+RRF fusion in-process (ADR 002).
      5-question/2-config proof run done (real API calls): dense 4/5,
      hybrid 5/5, hybrid also faster and cheaper on this sample. **Stopped
      at the checkpoint** before the full sweep — cost projection reported
      to the human, awaiting go-ahead.
- [x] **Full sweep: baseline dense vs +hybrid across all 43 golden
      questions.** dense 32/43 PASS (4 SEVERE), hybrid 34/43 PASS (3
      SEVERE); zero added latency, cost within noise (+2.3%). See
      `docs/decisions/003-hybrid-retrieval-ablation.md`. Recommendation
      (Proposed, pending sign-off): hybrid becomes the base config for the
      remaining legs. All 4 remaining SEVEREs trace to the chunking-knob
      and refusal-exactness issues below, not retrieval ranking.
- [ ] Chunking knob: `MIN_CHUNK_CONTENT_CHARS` 50 vs 0 (needs a re-chunk +
      re-embed variant of all 3 benchmark docs).
- [ ] Top-k knob: 6 vs higher.
- [ ] Contextual Retrieval (prepend LLM-generated context per chunk before
      embedding; indexing cost via `claude-haiku-4-5` per ADR 001).
- [ ] Embedding model benchmark (3-small vs Gemini/Voyage/Cohere v4/Qwen3/BGE).
- [ ] Chunking strategy comparison (fixed vs semantic vs contextual).
- [ ] Reranker (Cohere/Voyage/BGE/Qwen3) — **no reranker vendor key
      configured yet**; needs one before this leg can run.
- [ ] Leaderboard with cost + latency columns; ablation showing marginal value
      per component.

## Block 2.3 — Hybrid retrieval router — ⏳ NOT STARTED
- [ ] Depends on 2.2's benchmark data. No router code found.

## Block 2.4 — Smarter document extractor — ⏳ NOT STARTED
- [ ] Docling / VLM parser benchmark vs current rules-based parser. No Docling
      or VLM-parser dependency added; F-122 path still frozen (correctly untouched).

## Block 2.5 — Coverage agent (LangGraph) — ⏳ NOT STARTED
- [ ] No `langgraph` dependency in `apps/ai/pyproject.toml`. No agent code found.

## Block 2.6 — In-product trust dashboard — ⏳ NOT STARTED
- [ ] Depends on 2.2/2.5 outputs (grounding scores, verification rates, benchmark
      leaderboard) which don't exist yet.

---

## What's next

**Block 2.2 — Retrieval Lab v2.** It's next in sequence, it's explicitly called
out as the "defensible benchmark" recruiter artifact, and 2.3/2.6 both depend on
its output. The three real policy-form PDFs are already sitting in
`docs/policy-corpus/`, so the immediate sub-steps are:
1. Write golden Q&A for F-123 and F-144 (mirroring `golden.json`'s structure).
2. Set latency + cost budgets up front.
3. Ablate baseline → +hybrid(BM25) → +contextual chunks → +reranker → +router,
   each as its own ADR with a scorecard, per `docs/claimdesk-phase-2-kickoff-brief.md` §5A.
