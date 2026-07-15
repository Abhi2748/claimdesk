# Coverage agent golden-set eval (Block 2.5e)

Run: 2026-07-15T03:35:46.687092+00:00

PASS=7 FAIL=3 SEVERE=0 ERROR=0 / 10

Latency (graph-measured): p50=20118ms p95=27785ms

| id | form | status | verdict | expected | latency_ms | grounding | notes |
|---|---|---|---|---|---|---|---|
| 1 | F-122-ABLATION-MC0 | FAIL | partial | covered | 22170 | 0.68 | verdict partial != expected covered; missing cite(s): ['III.A'] |
| 2 | F-122-ABLATION-MC0 | FAIL | partial | excluded | 22569 | 0.50 | verdict partial != expected excluded; missing cite(s): ['IV.5'] |
| 3 | F-122-ABLATION-MC0 | FAIL | partial | partial | 20118 | 0.51 | missing cite(s): ['III.A.8'] |
| 4 | F-122-ABLATION-MC0 | PASS | unclear | unclear | 13932 | 0.51 | OK |
| 5 | F-123-MC0 | PASS | covered | covered | 16276 | 0.62 | OK |
| 6 | F-123-MC0 | PASS | excluded | excluded | 16182 | 0.66 | OK |
| 7 | F-123-MC0 | PASS | partial | partial | 21422 | 0.53 | OK |
| 8 | F-144-MC0 | PASS | covered | covered | 27785 | 0.58 | OK |
| 9 | F-144-MC0 | PASS | excluded | excluded | 13723 | 0.55 | OK |
| 10 | F-144-MC0 | PASS | partial | partial | 23263 | 0.56 | OK |

## Per-node latency (seconds, from Langfuse spans)

| node | n | p50 | p95 | mean |
|---|---|---|---|---|
| retrieval | 10 | 0.52 | 1.73 | 0.61 |
| claude_answer | 10 | 15.31 | 25.25 | 16.95 |
| verify_and_score | 10 | 1.50 | 4.71 | 1.97 |
| write_review_queue | 10 | 0.16 | 0.22 | 0.16 |

## Cost (char/4 estimate — Langfuse's list endpoint returns latency only, no usage/cost fields)

Input side from one real `retrieve_hybrid()` call (claim 1's actual retrieved passages, not a
guess): system prompt (1,405 chars) + tool schema (1,037 chars) + real retrieved passages
(8,300 chars) + claim text ≈ 10,898 chars → ~2,724 input tokens. Output side from every
opinion's real serialized size (`CoverageOpinion.model_dump_json()` length / 4).

At `claude-sonnet-4-6` pricing ($3/$15 per MTok in/out, per ADR 001/007):

| | value |
|---|---|
| est. input tokens/call | ~2,724 |
| est. output tokens/call | mean 986, range 548-1,537 |
| est. cost/opinion | mean $0.0230, range $0.0164-$0.0312 |
| est. total for 10 opinions | ~$0.23 |

Against ADR 009's ≤$0.05/opinion budget: mean cost uses 46% of budget, well inside — embedding
cost not included (negligible per ADR 001's existing estimate, unchanged here).
