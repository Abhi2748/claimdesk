# Retrieval Lab v2 — Ablation Results

Run: 2026-07-14T23:37:07.447Z

Configs: `hybrid` | Docs: `F-122-ABLATION-MC0, F-123-MC0, F-144-MC0` | topK=10 pool=20

## Leaderboard (all docs combined)

| config | n | PASS | FAIL | SEVERE | p50 latency (ms) | p95 latency (ms) | p50 retrieval (ms) | avg cost/query | total cost |
|---|---|---|---|---|---|---|---|---|---|
| hybrid | 43 | 41 | 2 | 0 | 6451 | 9385 | 185 | $0.00769 | $0.33068 |

## By document x config

| doc | config | n | PASS | FAIL | SEVERE | p50 latency (ms) | avg cost/query |
|---|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | hybrid | 20 | 18 | 2 | 0 | 6697 | $0.00807 |
| F-123-MC0 | hybrid | 13 | 13 | 0 | 0 | 6065 | $0.00747 |
| F-144-MC0 | hybrid | 10 | 10 | 0 | 0 | 6196 | $0.00721 |

## All rows

| doc | config | id | difficulty | status | top_sim | retrieval_ms | gen_ms | total_ms | in_tok | out_tok | cost | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | hybrid | 1 | easy | PASS | 0.736 | 226 | 2671 | 2899 | 1274 | 87 | $0.00513 | Cited II.B |
| F-122-ABLATION-MC0 | hybrid | 2 | easy | PASS | 0.726 | 259 | 6447 | 6706 | 1156 | 290 | $0.00782 | Cited II.C.2 |
| F-122-ABLATION-MC0 | hybrid | 3 | easy | PASS | 0.677 | 307 | 6309 | 6616 | 965 | 329 | $0.00783 | Cited III.A.3 |
| F-122-ABLATION-MC0 | hybrid | 4 | easy | FAIL | 0.417 | 294 | 4452 | 4746 | 1871 | 135 | $0.00764 | Missing required cite: III.B.8 |
| F-122-ABLATION-MC0 | hybrid | 5 | easy | PASS | 0.704 | 274 | 6423 | 6697 | 885 | 349 | $0.00789 | Cited VII.G.4 |
| F-122-ABLATION-MC0 | hybrid | 6 | easy | PASS | 0.651 | 205 | 6167 | 6372 | 1615 | 303 | $0.00939 | Cited III.C.2.a |
| F-122-ABLATION-MC0 | hybrid | 7 | medium | PASS | 0.703 | 224 | 6126 | 6350 | 1154 | 346 | $0.00865 | Cited III.D.2 |
| F-122-ABLATION-MC0 | hybrid | 8 | medium | PASS | 0.560 | 166 | 8163 | 8329 | 1836 | 308 | $0.01013 | Cited III.C.2.b |
| F-122-ABLATION-MC0 | hybrid | 9 | medium | PASS | 0.490 | 376 | 9687 | 10063 | 1228 | 217 | $0.00694 | Cited III.B.5 |
| F-122-ABLATION-MC0 | hybrid | 10 | medium | PASS | 0.729 | 213 | 4584 | 4797 | 1043 | 173 | $0.00572 | Cited VI.C |
| F-122-ABLATION-MC0 | hybrid | 11 | medium | PASS | 0.684 | 173 | 9552 | 9725 | 1459 | 462 | $0.01131 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION-MC0 | hybrid | 12 | medium | PASS | 0.554 | 191 | 4976 | 5167 | 1216 | 216 | $0.00689 | Cited VII.O |
| F-122-ABLATION-MC0 | hybrid | 13 | medium | PASS | 0.520 | 172 | 3504 | 3676 | 1528 | 140 | $0.00668 | Cited IV.14 |
| F-122-ABLATION-MC0 | hybrid | 14 | hard | PASS | 0.469 | 167 | 7183 | 7350 | 1272 | 296 | $0.00826 | Cited V.D.4, II.B |
| F-122-ABLATION-MC0 | hybrid | 15 | hard | PASS | 0.524 | 183 | 8426 | 8609 | 1237 | 315 | $0.00844 | Cited V.D.5 |
| F-122-ABLATION-MC0 | hybrid | 16 | hard | PASS | 0.528 | 191 | 8723 | 8914 | 1737 | 318 | $0.00998 | Cited V.C, II.C.20 |
| F-122-ABLATION-MC0 | hybrid | 17 | hard | PASS | 0.606 | 169 | 7175 | 7344 | 1281 | 307 | $0.00845 | Cited V.A.5 |
| F-122-ABLATION-MC0 | hybrid | 18 | hard | FAIL | 0.511 | 200 | 9025 | 9225 | 1421 | 366 | $0.00975 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION-MC0 | hybrid | 19 | hard | PASS | 0.772 | 181 | 8986 | 9167 | 1583 | 349 | $0.00998 | Cited I.G |
| F-122-ABLATION-MC0 | hybrid | 20 | refusal | PASS | 0.483 | 160 | 1367 | 1527 | 1467 | 12 | $0.00458 | Correct refusal |
| F-123-MC0 | hybrid | 1 | easy | PASS | 0.736 | 78 | 2468 | 2546 | 996 | 72 | $0.00407 | Cited II.B |
| F-123-MC0 | hybrid | 2 | easy | PASS | 0.727 | 72 | 6379 | 6451 | 1092 | 280 | $0.00748 | Cited II.C.2 |
| F-123-MC0 | hybrid | 3 | easy | PASS | 0.673 | 166 | 9218 | 9385 | 1885 | 328 | $0.01058 | Cited III.C.2.a |
| F-123-MC0 | hybrid | 4 | easy | PASS | 0.642 | 212 | 3879 | 4091 | 1473 | 154 | $0.00673 | Cited III.C.1 |
| F-123-MC0 | hybrid | 5 | medium | PASS | 0.708 | 176 | 5889 | 6065 | 1244 | 311 | $0.00840 | Cited III.D.2 |
| F-123-MC0 | hybrid | 6 | medium | PASS | 0.624 | 240 | 4334 | 4574 | 843 | 215 | $0.00575 | Cited III.B.3 |
| F-123-MC0 | hybrid | 7 | medium | PASS | 0.590 | 201 | 5301 | 5502 | 1031 | 234 | $0.00660 | Cited III.B.8 |
| F-123-MC0 | hybrid | 8 | medium | PASS | 0.592 | 185 | 8569 | 8754 | 966 | 428 | $0.00932 | Cited III.B.1 |
| F-123-MC0 | hybrid | 9 | hard | PASS | 0.668 | 167 | 6885 | 7052 | 861 | 313 | $0.00728 | Cited I.A.2 |
| F-123-MC0 | hybrid | 10 | hard | PASS | 0.549 | 180 | 3635 | 3815 | 1217 | 181 | $0.00637 | Cited VII.O |
| F-123-MC0 | hybrid | 11 | hard | PASS | 0.540 | 231 | 8766 | 8997 | 1549 | 339 | $0.00973 | Cited V.D.5 |
| F-123-MC0 | hybrid | 12 | hard | PASS | 0.539 | 175 | 6668 | 6843 | 1481 | 265 | $0.00842 | Cited V.C |
| F-123-MC0 | hybrid | 13 | refusal | PASS | 0.417 | 166 | 4282 | 4448 | 1671 | 94 | $0.00642 | Correct refusal |
| F-144-MC0 | hybrid | 1 | easy | PASS | 0.653 | 232 | 5964 | 6196 | 992 | 302 | $0.00751 | Cited I.A |
| F-144-MC0 | hybrid | 2 | easy | PASS | 0.734 | 167 | 2158 | 2325 | 1326 | 63 | $0.00492 | Cited II.B |
| F-144-MC0 | hybrid | 3 | easy | PASS | 0.774 | 72 | 8352 | 8424 | 1012 | 326 | $0.00793 | Cited I.G |
| F-144-MC0 | hybrid | 4 | medium | PASS | 0.579 | 170 | 6553 | 6723 | 1518 | 327 | $0.00946 | Cited VII.B, VII.C |
| F-144-MC0 | hybrid | 5 | medium | PASS | 0.603 | 174 | 6247 | 6421 | 956 | 328 | $0.00779 | Cited VIII.R.1 |
| F-144-MC0 | hybrid | 6 | medium | PASS | 0.591 | 231 | 3581 | 3812 | 1149 | 153 | $0.00574 | Cited III.D.6.a |
| F-144-MC0 | hybrid | 7 | hard | PASS | 0.599 | 204 | 6436 | 6640 | 1442 | 294 | $0.00874 | Cited VIII.R.2.b |
| F-144-MC0 | hybrid | 8 | hard | PASS | 0.613 | 208 | 6847 | 7055 | 1004 | 374 | $0.00862 | Cited VIII.R.3 |
| F-144-MC0 | hybrid | 9 | hard | PASS | 0.519 | 541 | 5116 | 5657 | 1447 | 191 | $0.00721 | Cited V.D.5 |
| F-144-MC0 | hybrid | 10 | refusal | PASS | 0.460 | 165 | 2931 | 3096 | 988 | 80 | $0.00416 | Correct refusal |
