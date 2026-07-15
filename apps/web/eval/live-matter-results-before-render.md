# Live /qa/matter eval (ADR 007)

Run: 2026-07-15T00:11:31.589Z

Target: `https://claimdesk-zkqi.onrender.com/qa/matter` (hybrid dense+BM25, MATTER_QA_TOP_K=10, MATTER_QA_POOL=20)

## Summary

- **PASS:** 37 / 43
- **FAIL:** 6 / 43
- **SEVERE:** 0 / 43
- **p50 latency:** 6866ms
- **p95 latency:** 9312ms

## All rows

| doc | id | difficulty | status | top_sim | total_ms | notes |
|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | 1 | easy | PASS | 0.736 | 5893 | Cited II.B |
| F-122-ABLATION-MC0 | 2 | easy | PASS | 0.726 | 4545 | Cited II.C.2 |
| F-122-ABLATION-MC0 | 3 | easy | PASS | 0.677 | 8688 | Cited III.A.3 |
| F-122-ABLATION-MC0 | 4 | easy | FAIL | 0.417 | 2122 | Missing required cite: III.B.8 |
| F-122-ABLATION-MC0 | 5 | easy | PASS | 0.704 | 6854 | Cited VII.G.4 |
| F-122-ABLATION-MC0 | 6 | easy | PASS | 0.651 | 8725 | Cited III.C.2.a |
| F-122-ABLATION-MC0 | 7 | medium | PASS | 0.703 | 6866 | Cited III.D.2 |
| F-122-ABLATION-MC0 | 8 | medium | PASS | 0.560 | 8915 | Cited III.C.2.b |
| F-122-ABLATION-MC0 | 9 | medium | PASS | 0.490 | 8296 | Cited III.B.5 |
| F-122-ABLATION-MC0 | 10 | medium | PASS | 0.729 | 7781 | Cited VI.C |
| F-122-ABLATION-MC0 | 11 | medium | PASS | 0.684 | 8254 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION-MC0 | 12 | medium | PASS | 0.554 | 4660 | Cited VII.O |
| F-122-ABLATION-MC0 | 13 | medium | FAIL | 0.520 | 4845 | Missing required cite: IV.14 |
| F-122-ABLATION-MC0 | 14 | hard | PASS | 0.469 | 7495 | Cited V.D.4, II.B |
| F-122-ABLATION-MC0 | 15 | hard | PASS | 0.524 | 8557 | Cited V.D.5 |
| F-122-ABLATION-MC0 | 16 | hard | PASS | 0.528 | 9416 | Cited V.C, II.C.20 |
| F-122-ABLATION-MC0 | 17 | hard | PASS | 0.606 | 6369 | Cited V.A.5 |
| F-122-ABLATION-MC0 | 18 | hard | FAIL | 0.511 | 8969 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION-MC0 | 19 | hard | PASS | 0.772 | 7367 | Cited I.G |
| F-122-ABLATION-MC0 | 20 | refusal | PASS | 0.483 | 1692 | Correct refusal |
| F-123-MC0 | 1 | easy | PASS | 0.736 | 2824 | Cited II.B |
| F-123-MC0 | 2 | easy | PASS | 0.727 | 6813 | Cited II.C.2 |
| F-123-MC0 | 3 | easy | PASS | 0.673 | 7098 | Cited III.C.2.a |
| F-123-MC0 | 4 | easy | PASS | 0.642 | 3273 | Cited III.C.1 |
| F-123-MC0 | 5 | medium | PASS | 0.708 | 6137 | Cited III.D.2 |
| F-123-MC0 | 6 | medium | PASS | 0.624 | 4449 | Cited III.B.3 |
| F-123-MC0 | 7 | medium | PASS | 0.590 | 4429 | Cited III.B.8 |
| F-123-MC0 | 8 | medium | PASS | 0.592 | 9158 | Cited III.B.1 |
| F-123-MC0 | 9 | hard | PASS | 0.668 | 6519 | Cited I.A.2 |
| F-123-MC0 | 10 | hard | PASS | 0.549 | 4744 | Cited VII.O |
| F-123-MC0 | 11 | hard | PASS | 0.540 | 9312 | Cited V.D.5 |
| F-123-MC0 | 12 | hard | PASS | 0.539 | 10510 | Cited V.C |
| F-123-MC0 | 13 | refusal | PASS | 0.417 | 3343 | Correct refusal |
| F-144-MC0 | 1 | easy | FAIL | 0.653 | 6400 | Missing required cite: I.A |
| F-144-MC0 | 2 | easy | PASS | 0.734 | 3082 | Cited II.B |
| F-144-MC0 | 3 | easy | PASS | 0.774 | 6971 | Cited I.G |
| F-144-MC0 | 4 | medium | PASS | 0.579 | 7546 | Cited VII.B, VII.C |
| F-144-MC0 | 5 | medium | PASS | 0.603 | 7271 | Cited VIII.R.1 |
| F-144-MC0 | 6 | medium | PASS | 0.591 | 4714 | Cited III.D.6.a |
| F-144-MC0 | 7 | hard | FAIL | 0.599 | 7614 | Missing required cite: VIII.R.2.b |
| F-144-MC0 | 8 | hard | PASS | 0.613 | 7230 | Cited VIII.R.3 |
| F-144-MC0 | 9 | hard | FAIL | 0.519 | 8230 | Missing required cite: V.D.5 |
| F-144-MC0 | 10 | refusal | PASS | 0.460 | 1911 | Correct refusal |
