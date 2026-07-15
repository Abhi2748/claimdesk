# Coverage agent golden-set eval (Block 2.5e)

Run: 2026-07-15T06:57:12.378573+00:00

PASS=8 FAIL=2 SEVERE=0 ERROR=0 / 10

Latency (graph-measured): p50=19538ms p95=31857ms

| id | form | status | verdict | expected | latency_ms | grounding | notes |
|---|---|---|---|---|---|---|---|
| 1 | F-122-ABLATION-MC0 | FAIL | partial | covered | 23090 | 0.51 | verdict partial != expected covered; missing cite(s): ['III.A'] |
| 2 | F-122-ABLATION-MC0 | FAIL | partial | excluded | 22246 | 0.50 | verdict partial != expected excluded; missing cite(s): ['IV.5'] |
| 3 | F-122-ABLATION-MC0 | PASS | partial | partial | 18952 | 0.41 | OK |
| 4 | F-122-ABLATION-MC0 | PASS | unclear | unclear | 15773 | 0.51 | OK |
| 5 | F-123-MC0 | PASS | covered | covered | 19538 | 0.61 | OK |
| 6 | F-123-MC0 | PASS | excluded | excluded | 18487 | 0.63 | OK |
| 7 | F-123-MC0 | PASS | partial | partial | 21633 | 0.31 | OK |
| 8 | F-144-MC0 | PASS | covered | covered | 21972 | 0.36 | OK |
| 9 | F-144-MC0 | PASS | excluded | excluded | 15240 | 0.50 | OK |
| 10 | F-144-MC0 | PASS | partial | partial | 31857 | 0.53 | OK |

## Per-node latency (seconds, from Langfuse spans)

| node | n | p50 | p95 | mean |
|---|---|---|---|---|
| retrieval | 10 | 0.43 | 1.20 | 0.59 |
| claude_answer | 9 | 16.53 | 20.03 | 17.11 |
| verify_and_score | 9 | 1.77 | 2.49 | 1.71 |
| write_review_queue | 9 | 0.16 | 0.34 | 0.18 |
