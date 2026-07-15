# Live /qa/matter eval (ADR 007)

Run: 2026-07-15T00:51:29.573Z

Target: `https://claimdesk-zkqi.onrender.com/qa/matter` (hybrid dense+BM25, MATTER_QA_TOP_K=10, MATTER_QA_POOL=20)

## Summary

- **PASS:** 41 / 43
- **FAIL:** 2 / 43
- **SEVERE:** 0 / 43
- **p50 latency:** 7576ms
- **p95 latency:** 11278ms

## All rows

| doc | id | difficulty | status | top_sim | total_ms | notes |
|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | 1 | easy | PASS | 0.736 | 4629 | Cited II.B |
| F-122-ABLATION-MC0 | 2 | easy | PASS | 0.726 | 4406 | Cited II.C.2 |
| F-122-ABLATION-MC0 | 3 | easy | PASS | 0.677 | 7995 | Cited III.A.3 |
| F-122-ABLATION-MC0 | 4 | easy | FAIL | 0.417 | 6761 | Missing required cite: III.B.8 |
| F-122-ABLATION-MC0 | 5 | easy | PASS | 0.704 | 7998 | Cited VII.G.4 |
| F-122-ABLATION-MC0 | 6 | easy | PASS | 0.651 | 10624 | Cited III.C.2.a |
| F-122-ABLATION-MC0 | 7 | medium | PASS | 0.703 | 8478 | Cited III.D.2 |
| F-122-ABLATION-MC0 | 8 | medium | PASS | 0.560 | 8020 | Cited III.C.2.b |
| F-122-ABLATION-MC0 | 9 | medium | PASS | 0.490 | 9342 | Cited III.B.5 |
| F-122-ABLATION-MC0 | 10 | medium | PASS | 0.729 | 5547 | Cited VI.C |
| F-122-ABLATION-MC0 | 11 | medium | PASS | 0.684 | 10273 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION-MC0 | 12 | medium | PASS | 0.554 | 5247 | Cited VII.O |
| F-122-ABLATION-MC0 | 13 | medium | PASS | 0.520 | 5674 | Cited IV.14 |
| F-122-ABLATION-MC0 | 14 | hard | PASS | 0.469 | 14660 | Cited V.D.4, II.B |
| F-122-ABLATION-MC0 | 15 | hard | PASS | 0.524 | 11304 | Cited V.D.5 |
| F-122-ABLATION-MC0 | 16 | hard | PASS | 0.528 | 10225 | Cited V.C, II.C.20 |
| F-122-ABLATION-MC0 | 17 | hard | PASS | 0.606 | 9524 | Cited V.A.5 |
| F-122-ABLATION-MC0 | 18 | hard | FAIL | 0.511 | 9318 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION-MC0 | 19 | hard | PASS | 0.772 | 10147 | Cited I.G |
| F-122-ABLATION-MC0 | 20 | refusal | PASS | 0.483 | 2331 | Correct refusal |
| F-123-MC0 | 1 | easy | PASS | 0.736 | 3321 | Cited II.B |
| F-123-MC0 | 2 | easy | PASS | 0.727 | 7580 | Cited II.C.2 |
| F-123-MC0 | 3 | easy | PASS | 0.673 | 10651 | Cited III.C.2.a |
| F-123-MC0 | 4 | easy | PASS | 0.642 | 6419 | Cited III.C.1 |
| F-123-MC0 | 5 | medium | PASS | 0.708 | 6701 | Cited III.D.2 |
| F-123-MC0 | 6 | medium | PASS | 0.624 | 6253 | Cited III.B.3 |
| F-123-MC0 | 7 | medium | PASS | 0.590 | 6352 | Cited III.B.8 |
| F-123-MC0 | 8 | medium | PASS | 0.592 | 9419 | Cited III.B.1 |
| F-123-MC0 | 9 | hard | PASS | 0.668 | 11278 | Cited I.A.2 |
| F-123-MC0 | 10 | hard | PASS | 0.549 | 4239 | Cited VII.O |
| F-123-MC0 | 11 | hard | PASS | 0.540 | 8736 | Cited V.D.5 |
| F-123-MC0 | 12 | hard | PASS | 0.539 | 8972 | Cited V.C |
| F-123-MC0 | 13 | refusal | PASS | 0.417 | 3143 | Correct refusal |
| F-144-MC0 | 1 | easy | PASS | 0.653 | 7279 | Cited I.A |
| F-144-MC0 | 2 | easy | PASS | 0.734 | 4096 | Cited II.B |
| F-144-MC0 | 3 | easy | PASS | 0.774 | 7896 | Cited I.G |
| F-144-MC0 | 4 | medium | PASS | 0.579 | 9879 | Cited VII.B, VII.C |
| F-144-MC0 | 5 | medium | PASS | 0.603 | 6902 | Cited VIII.R.1 |
| F-144-MC0 | 6 | medium | PASS | 0.591 | 6783 | Cited III.D.6.a |
| F-144-MC0 | 7 | hard | PASS | 0.599 | 4106 | Cited VIII.R.2.b |
| F-144-MC0 | 8 | hard | PASS | 0.613 | 7576 | Cited VIII.R.3 |
| F-144-MC0 | 9 | hard | PASS | 0.519 | 5586 | Cited V.D.5 |
| F-144-MC0 | 10 | refusal | PASS | 0.460 | 4257 | Correct refusal |
