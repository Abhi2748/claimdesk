# Chunking-knob (MIN_CHUNK_CONTENT_CHARS) x top-K ablation — combined leaderboard
Backing data for ADR 004. All rows are real API calls, hybrid retriever only, across the 43-question 3-doc benchmark corpus (F-122-ABLATION/F-123/F-144).

## Leaderboard (all 4 cells)

| cell | chunking | topK | n | PASS | FAIL | SEVERE | p50 ms | p95 ms | p50 retr ms | avg cost/q | total cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A: baseline | 50-char | 6 | 43 | 34 | 6 | 3 | 6178 | 8922 | 204 | $0.00658 | $0.28298 |
| B: baseline+topK10 | 50-char | 10 | 43 | 36 | 4 | 3 | 6422 | 9732 | 237 | $0.00801 | $0.34463 |
| C: MC0+topK6 | 0-char | 6 | 43 | 36 | 4 | 3 | 6165 | 8846 | 170 | $0.00629 | $0.27054 |
| D: MC0+topK10 | 0-char | 10 | 43 | 39 | 2 | 2 | 6341 | 8781 | 181 | $0.00766 | $0.32935 |

## Status changes vs A (baseline, 50-char, topK=6) — hybrid only

| doc / Q | A (baseline) | B (topK10) | C (MC0) | D (MC0+topK10) |
|---|---|---|---|---|
| F-122-ABLATION Q10 | FAIL | FAIL | PASS | PASS |
| F-122-ABLATION Q16 | FAIL | PASS | FAIL | PASS |
| F-123 Q8 | FAIL | PASS | PASS | PASS |
| F-123 Q12 | SEVERE | SEVERE | PASS | PASS |
| F-144 Q7 | PASS | PASS | FAIL | PASS |
| F-144 Q9 | FAIL | FAIL | SEVERE | PASS |

All other 37 questions unchanged across all 4 cells.
