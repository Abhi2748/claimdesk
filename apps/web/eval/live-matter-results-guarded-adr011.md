# Live /qa/matter eval (ADR 007)

Run: 2026-07-15T06:56:59.835Z

Target: `http://127.0.0.1:8000/qa/matter` (hybrid dense+BM25, MATTER_QA_TOP_K=10, MATTER_QA_POOL=20)

## Summary

- **PASS:** 39 / 43
- **FAIL:** 4 / 43
- **SEVERE:** 0 / 43
- **p50 latency:** 7416ms
- **p95 latency:** 12367ms

## All rows

| doc | id | difficulty | status | top_sim | total_ms | notes |
|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | 1 | easy | FAIL | 0.736 | 6079 | Missing required cite: II.B |
| F-122-ABLATION-MC0 | 2 | easy | PASS | 0.726 | 4591 | Cited II.C.2 |
| F-122-ABLATION-MC0 | 3 | easy | PASS | 0.677 | 7688 | Cited III.A.3 |
| F-122-ABLATION-MC0 | 4 | easy | FAIL | 0.417 | 4826 | Missing required cite: III.B.8 |
| F-122-ABLATION-MC0 | 5 | easy | PASS | 0.704 | 8232 | Cited VII.G.4 |
| F-122-ABLATION-MC0 | 6 | easy | PASS | 0.651 | 9043 | Cited III.C.2.a |
| F-122-ABLATION-MC0 | 7 | medium | PASS | 0.703 | 9550 | Cited III.D.2 |
| F-122-ABLATION-MC0 | 8 | medium | PASS | 0.560 | 12008 | Cited III.C.2.b |
| F-122-ABLATION-MC0 | 9 | medium | PASS | 0.490 | 9408 | Cited III.B.5 |
| F-122-ABLATION-MC0 | 10 | medium | PASS | 0.729 | 6284 | Cited VI.C |
| F-122-ABLATION-MC0 | 11 | medium | PASS | 0.684 | 14954 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION-MC0 | 12 | medium | PASS | 0.554 | 4787 | Cited VII.O |
| F-122-ABLATION-MC0 | 13 | medium | PASS | 0.520 | 4625 | Cited IV.14 |
| F-122-ABLATION-MC0 | 14 | hard | PASS | 0.469 | 9001 | Cited V.D.4, II.B |
| F-122-ABLATION-MC0 | 15 | hard | PASS | 0.524 | 9806 | Cited V.D.5 |
| F-122-ABLATION-MC0 | 16 | hard | PASS | 0.528 | 12367 | Cited V.C, II.C.20 |
| F-122-ABLATION-MC0 | 17 | hard | PASS | 0.606 | 7856 | Cited V.A.5 |
| F-122-ABLATION-MC0 | 18 | hard | FAIL | 0.511 | 15049 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION-MC0 | 19 | hard | PASS | 0.772 | 9806 | Cited I.G |
| F-122-ABLATION-MC0 | 20 | refusal | PASS | 0.483 | 3878 | Correct refusal |
| F-123-MC0 | 1 | easy | PASS | 0.736 | 3340 | Cited II.B |
| F-123-MC0 | 2 | easy | PASS | 0.727 | 4899 | Cited II.C.2 |
| F-123-MC0 | 3 | easy | PASS | 0.673 | 10267 | Cited III.C.2.a |
| F-123-MC0 | 4 | easy | PASS | 0.642 | 4287 | Cited III.C.1 |
| F-123-MC0 | 5 | medium | PASS | 0.708 | 9627 | Cited III.D.2 |
| F-123-MC0 | 6 | medium | PASS | 0.624 | 6229 | Cited III.B.3 |
| F-123-MC0 | 7 | medium | PASS | 0.590 | 5637 | Cited III.B.8 |
| F-123-MC0 | 8 | medium | PASS | 0.592 | 8874 | Cited III.B.1 |
| F-123-MC0 | 9 | hard | PASS | 0.668 | 7416 | Cited I.A.2 |
| F-123-MC0 | 10 | hard | PASS | 0.549 | 5776 | Cited VII.O |
| F-123-MC0 | 11 | hard | PASS | 0.540 | 10100 | Cited V.D.5 |
| F-123-MC0 | 12 | hard | PASS | 0.539 | 7757 | Cited V.C |
| F-123-MC0 | 13 | refusal | PASS | 0.417 | 5952 | Correct refusal |
| F-144-MC0 | 1 | easy | PASS | 0.653 | 7095 | Cited I.A |
| F-144-MC0 | 2 | easy | FAIL | 0.734 | 4961 | Missing required cite: II.B |
| F-144-MC0 | 3 | easy | PASS | 0.774 | 8755 | Cited I.G |
| F-144-MC0 | 4 | medium | PASS | 0.579 | 8119 | Cited VII.B, VII.C |
| F-144-MC0 | 5 | medium | PASS | 0.603 | 5405 | Cited VIII.R.1 |
| F-144-MC0 | 6 | medium | PASS | 0.591 | 6239 | Cited III.D.6.a |
| F-144-MC0 | 7 | hard | PASS | 0.599 | 6179 | Cited VIII.R.2.b |
| F-144-MC0 | 8 | hard | PASS | 0.613 | 7558 | Cited VIII.R.3 |
| F-144-MC0 | 9 | hard | PASS | 0.519 | 7207 | Cited V.D.5 |
| F-144-MC0 | 10 | refusal | PASS | 0.460 | 5346 | Correct refusal |
