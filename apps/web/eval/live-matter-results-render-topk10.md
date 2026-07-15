# Live /qa/matter eval (ADR 007)

Run: 2026-07-15T00:35:33.890Z

Target: `https://claimdesk-zkqi.onrender.com/qa/matter` (hybrid dense+BM25, MATTER_QA_TOP_K=10, MATTER_QA_POOL=20)

## Summary

- **PASS:** 41 / 43
- **FAIL:** 2 / 43
- **SEVERE:** 0 / 43
- **p50 latency:** 8019ms
- **p95 latency:** 12164ms

## All rows

| doc | id | difficulty | status | top_sim | total_ms | notes |
|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | 1 | easy | PASS | 0.736 | 3757 | Cited II.B |
| F-122-ABLATION-MC0 | 2 | easy | PASS | 0.726 | 5730 | Cited II.C.2 |
| F-122-ABLATION-MC0 | 3 | easy | PASS | 0.677 | 8640 | Cited III.A.3 |
| F-122-ABLATION-MC0 | 4 | easy | FAIL | 0.417 | 3366 | Missing required cite: III.B.8 |
| F-122-ABLATION-MC0 | 5 | easy | PASS | 0.704 | 8114 | Cited VII.G.4 |
| F-122-ABLATION-MC0 | 6 | easy | PASS | 0.651 | 9256 | Cited III.C.2.a |
| F-122-ABLATION-MC0 | 7 | medium | PASS | 0.703 | 8864 | Cited III.D.2 |
| F-122-ABLATION-MC0 | 8 | medium | PASS | 0.560 | 9795 | Cited III.C.2.b |
| F-122-ABLATION-MC0 | 9 | medium | PASS | 0.490 | 13375 | Cited III.B.5 |
| F-122-ABLATION-MC0 | 10 | medium | PASS | 0.729 | 7201 | Cited VI.C |
| F-122-ABLATION-MC0 | 11 | medium | PASS | 0.684 | 13667 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION-MC0 | 12 | medium | PASS | 0.554 | 4773 | Cited VII.O |
| F-122-ABLATION-MC0 | 13 | medium | PASS | 0.520 | 4412 | Cited IV.14 |
| F-122-ABLATION-MC0 | 14 | hard | PASS | 0.469 | 8493 | Cited V.D.4, II.B |
| F-122-ABLATION-MC0 | 15 | hard | PASS | 0.524 | 9450 | Cited V.D.5 |
| F-122-ABLATION-MC0 | 16 | hard | PASS | 0.528 | 9044 | Cited V.C, II.C.20 |
| F-122-ABLATION-MC0 | 17 | hard | PASS | 0.606 | 9431 | Cited V.A.5 |
| F-122-ABLATION-MC0 | 18 | hard | FAIL | 0.511 | 9359 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION-MC0 | 19 | hard | PASS | 0.772 | 12164 | Cited I.G |
| F-122-ABLATION-MC0 | 20 | refusal | PASS | 0.483 | 2459 | Correct refusal |
| F-123-MC0 | 1 | easy | PASS | 0.736 | 2913 | Cited II.B |
| F-123-MC0 | 2 | easy | PASS | 0.727 | 6482 | Cited II.C.2 |
| F-123-MC0 | 3 | easy | PASS | 0.673 | 9659 | Cited III.C.2.a |
| F-123-MC0 | 4 | easy | PASS | 0.642 | 4759 | Cited III.C.1 |
| F-123-MC0 | 5 | medium | PASS | 0.708 | 6459 | Cited III.D.2 |
| F-123-MC0 | 6 | medium | PASS | 0.624 | 5401 | Cited III.B.3 |
| F-123-MC0 | 7 | medium | PASS | 0.590 | 8127 | Cited III.B.8 |
| F-123-MC0 | 8 | medium | PASS | 0.592 | 8791 | Cited III.B.1 |
| F-123-MC0 | 9 | hard | PASS | 0.668 | 7249 | Cited I.A.2 |
| F-123-MC0 | 10 | hard | PASS | 0.549 | 4860 | Cited VII.O |
| F-123-MC0 | 11 | hard | PASS | 0.540 | 9991 | Cited V.D.5 |
| F-123-MC0 | 12 | hard | PASS | 0.539 | 8660 | Cited V.C |
| F-123-MC0 | 13 | refusal | PASS | 0.417 | 3527 | Correct refusal |
| F-144-MC0 | 1 | easy | PASS | 0.653 | 8060 | Cited I.A |
| F-144-MC0 | 2 | easy | PASS | 0.734 | 3356 | Cited II.B |
| F-144-MC0 | 3 | easy | PASS | 0.774 | 8019 | Cited I.G |
| F-144-MC0 | 4 | medium | PASS | 0.579 | 9300 | Cited VII.B, VII.C |
| F-144-MC0 | 5 | medium | PASS | 0.603 | 7009 | Cited VIII.R.1 |
| F-144-MC0 | 6 | medium | PASS | 0.591 | 5947 | Cited III.D.6.a |
| F-144-MC0 | 7 | hard | PASS | 0.599 | 8067 | Cited VIII.R.2.b |
| F-144-MC0 | 8 | hard | PASS | 0.613 | 7689 | Cited VIII.R.3 |
| F-144-MC0 | 9 | hard | PASS | 0.519 | 5654 | Cited V.D.5 |
| F-144-MC0 | 10 | refusal | PASS | 0.460 | 3553 | Correct refusal |
