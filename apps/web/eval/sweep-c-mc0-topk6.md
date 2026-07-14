# Retrieval Lab v2 — Ablation Results

Run: 2026-07-14T22:59:59.732Z

Configs: `hybrid` | Docs: `F-122-ABLATION-MC0, F-123-MC0, F-144-MC0` | topK=6 pool=20

## Leaderboard (all docs combined)

| config | n | PASS | FAIL | SEVERE | p50 latency (ms) | p95 latency (ms) | p50 retrieval (ms) | avg cost/query | total cost |
|---|---|---|---|---|---|---|---|---|---|
| hybrid | 43 | 36 | 4 | 3 | 6165 | 8846 | 170 | $0.00629 | $0.27054 |

## By document x config

| doc | config | n | PASS | FAIL | SEVERE | p50 latency (ms) | avg cost/query |
|---|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | hybrid | 20 | 17 | 3 | 0 | 6395 | $0.00663 |
| F-123-MC0 | hybrid | 13 | 12 | 0 | 1 | 5106 | $0.00600 |
| F-144-MC0 | hybrid | 10 | 7 | 1 | 2 | 5599 | $0.00600 |

## All rows

| doc | config | id | difficulty | status | top_sim | retrieval_ms | gen_ms | total_ms | in_tok | out_tok | cost | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | hybrid | 1 | easy | PASS | 0.736 | 100 | 2486 | 2590 | 1012 | 74 | $0.00415 | Cited II.B |
| F-122-ABLATION-MC0 | hybrid | 2 | easy | PASS | 0.726 | 139 | 1790 | 1929 | 600 | 52 | $0.00258 | Cited II.C.2 |
| F-122-ABLATION-MC0 | hybrid | 3 | easy | PASS | 0.677 | 74 | 6435 | 6509 | 640 | 331 | $0.00689 | Cited III.A.3 |
| F-122-ABLATION-MC0 | hybrid | 4 | easy | FAIL | 0.417 | 212 | 3644 | 3856 | 981 | 137 | $0.00500 | Missing required cite: III.B.8 |
| F-122-ABLATION-MC0 | hybrid | 5 | easy | PASS | 0.704 | 160 | 6578 | 6738 | 648 | 357 | $0.00730 | Cited VII.G.4 |
| F-122-ABLATION-MC0 | hybrid | 6 | easy | PASS | 0.651 | 167 | 5885 | 6052 | 1234 | 305 | $0.00828 | Cited III.C.2.a |
| F-122-ABLATION-MC0 | hybrid | 7 | medium | PASS | 0.703 | 228 | 5650 | 5878 | 657 | 286 | $0.00626 | Cited III.D.2 |
| F-122-ABLATION-MC0 | hybrid | 8 | medium | PASS | 0.560 | 165 | 8984 | 9149 | 1532 | 322 | $0.00943 | Cited III.C.2.b |
| F-122-ABLATION-MC0 | hybrid | 9 | medium | PASS | 0.490 | 168 | 8533 | 8701 | 964 | 337 | $0.00795 | Cited III.B.5 |
| F-122-ABLATION-MC0 | hybrid | 10 | medium | PASS | 0.729 | 178 | 2314 | 2492 | 655 | 73 | $0.00306 | Cited VI.C |
| F-122-ABLATION-MC0 | hybrid | 11 | medium | PASS | 0.684 | 76 | 9458 | 9534 | 918 | 480 | $0.00995 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION-MC0 | hybrid | 12 | medium | PASS | 0.554 | 214 | 3978 | 4192 | 793 | 185 | $0.00515 | Cited VII.O |
| F-122-ABLATION-MC0 | hybrid | 13 | medium | PASS | 0.520 | 189 | 6089 | 6278 | 1035 | 212 | $0.00629 | Cited IV.14 |
| F-122-ABLATION-MC0 | hybrid | 14 | hard | PASS | 0.469 | 256 | 6139 | 6395 | 945 | 250 | $0.00659 | Cited V.D.4, II.B |
| F-122-ABLATION-MC0 | hybrid | 15 | hard | PASS | 0.524 | 178 | 7719 | 7898 | 940 | 326 | $0.00771 | Cited V.D.5 |
| F-122-ABLATION-MC0 | hybrid | 16 | hard | FAIL | 0.528 | 210 | 8636 | 8846 | 1345 | 316 | $0.00878 | Missing required cite: V.C, II.C.20 |
| F-122-ABLATION-MC0 | hybrid | 17 | hard | PASS | 0.606 | 165 | 6702 | 6867 | 851 | 276 | $0.00669 | Cited V.A.5 |
| F-122-ABLATION-MC0 | hybrid | 18 | hard | FAIL | 0.511 | 187 | 7571 | 7758 | 793 | 329 | $0.00731 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION-MC0 | hybrid | 19 | hard | PASS | 0.772 | 176 | 7979 | 8155 | 1102 | 404 | $0.00937 | Cited I.G |
| F-122-ABLATION-MC0 | hybrid | 20 | refusal | PASS | 0.483 | 154 | 1340 | 1494 | 1236 | 12 | $0.00389 | Correct refusal |
| F-123-MC0 | hybrid | 1 | easy | PASS | 0.736 | 71 | 2843 | 2914 | 762 | 74 | $0.00340 | Cited II.B |
| F-123-MC0 | hybrid | 2 | easy | PASS | 0.727 | 134 | 4677 | 4811 | 637 | 200 | $0.00491 | Cited II.C.2 |
| F-123-MC0 | hybrid | 3 | easy | PASS | 0.673 | 175 | 6789 | 6964 | 1433 | 352 | $0.00958 | Cited III.C.2.a |
| F-123-MC0 | hybrid | 4 | easy | PASS | 0.642 | 181 | 3816 | 3997 | 925 | 160 | $0.00518 | Cited III.C.1 |
| F-123-MC0 | hybrid | 5 | medium | PASS | 0.708 | 161 | 6405 | 6567 | 632 | 340 | $0.00700 | Cited III.D.2 |
| F-123-MC0 | hybrid | 6 | medium | PASS | 0.624 | 156 | 4950 | 5106 | 575 | 201 | $0.00474 | Cited III.B.3 |
| F-123-MC0 | hybrid | 7 | medium | PASS | 0.590 | 186 | 4057 | 4243 | 617 | 165 | $0.00433 | Cited III.B.8 |
| F-123-MC0 | hybrid | 8 | medium | PASS | 0.592 | 171 | 6683 | 6854 | 618 | 364 | $0.00731 | Cited III.B.1 |
| F-123-MC0 | hybrid | 9 | hard | PASS | 0.668 | 151 | 6014 | 6165 | 586 | 264 | $0.00572 | Cited I.A.2 |
| F-123-MC0 | hybrid | 10 | hard | PASS | 0.549 | 232 | 3544 | 3776 | 823 | 185 | $0.00524 | Cited VII.O |
| F-123-MC0 | hybrid | 11 | hard | PASS | 0.540 | 161 | 7557 | 7718 | 1075 | 333 | $0.00822 | Cited V.D.5 |
| F-123-MC0 | hybrid | 12 | hard | PASS | 0.539 | 174 | 7761 | 7935 | 943 | 343 | $0.00797 | Cited V.C |
| F-123-MC0 | hybrid | 13 | refusal | SEVERE | 0.417 | 184 | 3403 | 3587 | 1062 | 79 | $0.00437 | must_refuse question received substantive answer |
| F-144-MC0 | hybrid | 1 | easy | PASS | 0.653 | 150 | 5573 | 5723 | 717 | 277 | $0.00631 | Cited I.A |
| F-144-MC0 | hybrid | 2 | easy | PASS | 0.734 | 222 | 2618 | 2841 | 1051 | 75 | $0.00428 | Cited II.B |
| F-144-MC0 | hybrid | 3 | easy | PASS | 0.774 | 80 | 6824 | 6904 | 708 | 300 | $0.00662 | Cited I.G |
| F-144-MC0 | hybrid | 4 | medium | PASS | 0.579 | 170 | 6289 | 6459 | 1089 | 340 | $0.00837 | Cited VII.B, VII.C |
| F-144-MC0 | hybrid | 5 | medium | PASS | 0.603 | 153 | 4649 | 4802 | 595 | 214 | $0.00500 | Cited VIII.R.1 |
| F-144-MC0 | hybrid | 6 | medium | PASS | 0.591 | 201 | 4352 | 4553 | 509 | 190 | $0.00438 | Cited III.D.6.a |
| F-144-MC0 | hybrid | 7 | hard | FAIL | 0.599 | 171 | 6702 | 6873 | 999 | 306 | $0.00759 | Missing required cite: VIII.R.2.b |
| F-144-MC0 | hybrid | 8 | hard | PASS | 0.613 | 157 | 6134 | 6291 | 830 | 309 | $0.00713 | Cited VIII.R.3 |
| F-144-MC0 | hybrid | 9 | hard | SEVERE | 0.519 | 207 | 5392 | 5599 | 1112 | 201 | $0.00635 | Invented citation(s): V.D.3.A |
| F-144-MC0 | hybrid | 10 | refusal | SEVERE | 0.460 | 170 | 3416 | 3586 | 760 | 111 | $0.00395 | must_refuse question received substantive answer |
