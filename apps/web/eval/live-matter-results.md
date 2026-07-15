# Live /qa/matter eval (ADR 007)

Run: 2026-07-15T00:20:21.961Z

Target: `http://localhost:8000/qa/matter` (hybrid dense+BM25, MATTER_QA_TOP_K=10, MATTER_QA_POOL=20)

## Summary

- **PASS:** 41 / 43
- **FAIL:** 2 / 43
- **SEVERE:** 0 / 43
- **p50 latency:** 7440ms
- **p95 latency:** 9868ms

## All rows

| doc | id | difficulty | status | top_sim | total_ms | notes |
|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | 1 | easy | PASS | 0.736 | 5121 | Cited II.B |
| F-122-ABLATION-MC0 | 2 | easy | PASS | 0.726 | 5907 | Cited II.C.2 |
| F-122-ABLATION-MC0 | 3 | easy | PASS | 0.677 | 7839 | Cited III.A.3 |
| F-122-ABLATION-MC0 | 4 | easy | FAIL | 0.417 | 5059 | Missing required cite: III.B.8 |
| F-122-ABLATION-MC0 | 5 | easy | PASS | 0.704 | 7201 | Cited VII.G.4 |
| F-122-ABLATION-MC0 | 6 | easy | PASS | 0.651 | 8163 | Cited III.C.2.a |
| F-122-ABLATION-MC0 | 7 | medium | PASS | 0.703 | 8053 | Cited III.D.2 |
| F-122-ABLATION-MC0 | 8 | medium | PASS | 0.560 | 8921 | Cited III.C.2.b |
| F-122-ABLATION-MC0 | 9 | medium | PASS | 0.490 | 6586 | Cited III.B.5 |
| F-122-ABLATION-MC0 | 10 | medium | PASS | 0.729 | 5460 | Cited VI.C |
| F-122-ABLATION-MC0 | 11 | medium | PASS | 0.684 | 11475 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION-MC0 | 12 | medium | PASS | 0.554 | 4903 | Cited VII.O |
| F-122-ABLATION-MC0 | 13 | medium | PASS | 0.520 | 3810 | Cited IV.14 |
| F-122-ABLATION-MC0 | 14 | hard | PASS | 0.469 | 8305 | Cited V.D.4, II.B |
| F-122-ABLATION-MC0 | 15 | hard | PASS | 0.524 | 9147 | Cited V.D.5 |
| F-122-ABLATION-MC0 | 16 | hard | PASS | 0.528 | 9701 | Cited V.C, II.C.20 |
| F-122-ABLATION-MC0 | 17 | hard | PASS | 0.606 | 7146 | Cited V.A.5 |
| F-122-ABLATION-MC0 | 18 | hard | FAIL | 0.511 | 9868 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION-MC0 | 19 | hard | PASS | 0.772 | 10003 | Cited I.G |
| F-122-ABLATION-MC0 | 20 | refusal | PASS | 0.483 | 3160 | Correct refusal |
| F-123-MC0 | 1 | easy | PASS | 0.736 | 3660 | Cited II.B |
| F-123-MC0 | 2 | easy | PASS | 0.727 | 7483 | Cited II.C.2 |
| F-123-MC0 | 3 | easy | PASS | 0.673 | 9785 | Cited III.C.2.a |
| F-123-MC0 | 4 | easy | PASS | 0.642 | 6067 | Cited III.C.1 |
| F-123-MC0 | 5 | medium | PASS | 0.708 | 7035 | Cited III.D.2 |
| F-123-MC0 | 6 | medium | PASS | 0.624 | 5491 | Cited III.B.3 |
| F-123-MC0 | 7 | medium | PASS | 0.590 | 8107 | Cited III.B.8 |
| F-123-MC0 | 8 | medium | PASS | 0.592 | 7664 | Cited III.B.1 |
| F-123-MC0 | 9 | hard | PASS | 0.668 | 8963 | Cited I.A.2 |
| F-123-MC0 | 10 | hard | PASS | 0.549 | 5160 | Cited VII.O |
| F-123-MC0 | 11 | hard | PASS | 0.540 | 9362 | Cited V.D.5 |
| F-123-MC0 | 12 | hard | PASS | 0.539 | 7255 | Cited V.C |
| F-123-MC0 | 13 | refusal | PASS | 0.417 | 3890 | Correct refusal |
| F-144-MC0 | 1 | easy | PASS | 0.653 | 7440 | Cited I.A |
| F-144-MC0 | 2 | easy | PASS | 0.734 | 6713 | Cited II.B |
| F-144-MC0 | 3 | easy | PASS | 0.774 | 7932 | Cited I.G |
| F-144-MC0 | 4 | medium | PASS | 0.579 | 9033 | Cited VII.B, VII.C |
| F-144-MC0 | 5 | medium | PASS | 0.603 | 9372 | Cited VIII.R.1 |
| F-144-MC0 | 6 | medium | PASS | 0.591 | 7498 | Cited III.D.6.a |
| F-144-MC0 | 7 | hard | PASS | 0.599 | 6990 | Cited VIII.R.2.b |
| F-144-MC0 | 8 | hard | PASS | 0.613 | 7861 | Cited VIII.R.3 |
| F-144-MC0 | 9 | hard | PASS | 0.519 | 5917 | Cited V.D.5 |
| F-144-MC0 | 10 | refusal | PASS | 0.460 | 3711 | Correct refusal |
