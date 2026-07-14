# Retrieval Lab v2 — Ablation Results

Run: 2026-07-14T23:06:16.036Z

Configs: `hybrid` | Docs: `F-122-ABLATION-MC0, F-123-MC0, F-144-MC0` | topK=10 pool=20

## Leaderboard (all docs combined)

| config | n | PASS | FAIL | SEVERE | p50 latency (ms) | p95 latency (ms) | p50 retrieval (ms) | avg cost/query | total cost |
|---|---|---|---|---|---|---|---|---|---|
| hybrid | 43 | 39 | 2 | 2 | 6341 | 8781 | 181 | $0.00766 | $0.32935 |

## By document x config

| doc | config | n | PASS | FAIL | SEVERE | p50 latency (ms) | avg cost/query |
|---|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | hybrid | 20 | 18 | 2 | 0 | 6755 | $0.00818 |
| F-123-MC0 | hybrid | 13 | 12 | 0 | 1 | 5512 | $0.00717 |
| F-144-MC0 | hybrid | 10 | 9 | 0 | 1 | 5335 | $0.00725 |

## All rows

| doc | config | id | difficulty | status | top_sim | retrieval_ms | gen_ms | total_ms | in_tok | out_tok | cost | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-122-ABLATION-MC0 | hybrid | 1 | easy | PASS | 0.736 | 94 | 2441 | 2537 | 1274 | 69 | $0.00486 | Cited II.B |
| F-122-ABLATION-MC0 | hybrid | 2 | easy | PASS | 0.726 | 69 | 5106 | 5175 | 1156 | 219 | $0.00675 | Cited II.C.2 |
| F-122-ABLATION-MC0 | hybrid | 3 | easy | PASS | 0.677 | 187 | 6813 | 7001 | 965 | 329 | $0.00783 | Cited III.A.3 |
| F-122-ABLATION-MC0 | hybrid | 4 | easy | FAIL | 0.417 | 203 | 3326 | 3529 | 1871 | 75 | $0.00674 | Missing required cite: III.B.8 |
| F-122-ABLATION-MC0 | hybrid | 5 | easy | PASS | 0.704 | 148 | 6214 | 6362 | 885 | 329 | $0.00759 | Cited VII.G.4 |
| F-122-ABLATION-MC0 | hybrid | 6 | easy | PASS | 0.651 | 306 | 6522 | 6828 | 1615 | 330 | $0.00980 | Cited III.C.2.a |
| F-122-ABLATION-MC0 | hybrid | 7 | medium | PASS | 0.703 | 240 | 6347 | 6587 | 1154 | 377 | $0.00912 | Cited III.D.2 |
| F-122-ABLATION-MC0 | hybrid | 8 | medium | PASS | 0.560 | 212 | 7584 | 7796 | 1836 | 316 | $0.01025 | Cited III.C.2.b |
| F-122-ABLATION-MC0 | hybrid | 9 | medium | PASS | 0.490 | 175 | 6580 | 6755 | 1228 | 246 | $0.00737 | Cited III.B.5 |
| F-122-ABLATION-MC0 | hybrid | 10 | medium | PASS | 0.729 | 166 | 5683 | 5849 | 1043 | 260 | $0.00703 | Cited VI.C |
| F-122-ABLATION-MC0 | hybrid | 11 | medium | PASS | 0.684 | 163 | 12557 | 12720 | 1459 | 613 | $0.01357 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION-MC0 | hybrid | 12 | medium | PASS | 0.554 | 165 | 4221 | 4386 | 1216 | 183 | $0.00639 | Cited VII.O |
| F-122-ABLATION-MC0 | hybrid | 13 | medium | PASS | 0.520 | 175 | 3450 | 3625 | 1528 | 140 | $0.00668 | Cited IV.14 |
| F-122-ABLATION-MC0 | hybrid | 14 | hard | PASS | 0.469 | 235 | 8127 | 8362 | 1272 | 279 | $0.00800 | Cited V.D.4, II.B |
| F-122-ABLATION-MC0 | hybrid | 15 | hard | PASS | 0.524 | 362 | 7946 | 8308 | 1237 | 318 | $0.00848 | Cited V.D.5 |
| F-122-ABLATION-MC0 | hybrid | 16 | hard | PASS | 0.528 | 200 | 8317 | 8517 | 1737 | 374 | $0.01082 | Cited V.C, II.C.20 |
| F-122-ABLATION-MC0 | hybrid | 17 | hard | PASS | 0.606 | 244 | 7348 | 7592 | 1281 | 270 | $0.00789 | Cited V.A.5 |
| F-122-ABLATION-MC0 | hybrid | 18 | hard | FAIL | 0.511 | 188 | 8419 | 8607 | 1421 | 354 | $0.00957 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION-MC0 | hybrid | 19 | hard | PASS | 0.772 | 258 | 9045 | 9303 | 1583 | 369 | $0.01028 | Cited I.G |
| F-122-ABLATION-MC0 | hybrid | 20 | refusal | PASS | 0.483 | 181 | 1169 | 1350 | 1467 | 12 | $0.00458 | Correct refusal |
| F-123-MC0 | hybrid | 1 | easy | PASS | 0.736 | 97 | 2002 | 2099 | 996 | 65 | $0.00396 | Cited II.B |
| F-123-MC0 | hybrid | 2 | easy | PASS | 0.727 | 89 | 4320 | 4409 | 1092 | 173 | $0.00587 | Cited II.C.2 |
| F-123-MC0 | hybrid | 3 | easy | PASS | 0.673 | 196 | 8585 | 8781 | 1885 | 316 | $0.01040 | Cited III.C.2.a |
| F-123-MC0 | hybrid | 4 | easy | PASS | 0.642 | 195 | 5998 | 6193 | 1473 | 167 | $0.00692 | Cited III.C.1 |
| F-123-MC0 | hybrid | 5 | medium | PASS | 0.708 | 209 | 5303 | 5512 | 1244 | 275 | $0.00786 | Cited III.D.2 |
| F-123-MC0 | hybrid | 6 | medium | PASS | 0.624 | 211 | 3958 | 4169 | 843 | 199 | $0.00551 | Cited III.B.3 |
| F-123-MC0 | hybrid | 7 | medium | PASS | 0.590 | 183 | 4163 | 4346 | 1031 | 194 | $0.00600 | Cited III.B.8 |
| F-123-MC0 | hybrid | 8 | medium | PASS | 0.592 | 179 | 7402 | 7581 | 966 | 354 | $0.00821 | Cited III.B.1 |
| F-123-MC0 | hybrid | 9 | hard | PASS | 0.668 | 168 | 7467 | 7635 | 861 | 351 | $0.00785 | Cited I.A.2 |
| F-123-MC0 | hybrid | 10 | hard | PASS | 0.549 | 267 | 4172 | 4439 | 1217 | 182 | $0.00638 | Cited VII.O |
| F-123-MC0 | hybrid | 11 | hard | PASS | 0.540 | 171 | 8150 | 8321 | 1549 | 329 | $0.00958 | Cited V.D.5 |
| F-123-MC0 | hybrid | 12 | hard | PASS | 0.540 | 236 | 6916 | 7152 | 1481 | 279 | $0.00863 | Cited V.C |
| F-123-MC0 | hybrid | 13 | refusal | SEVERE | 0.417 | 172 | 2834 | 3006 | 1671 | 66 | $0.00600 | must_refuse question received substantive answer |
| F-144-MC0 | hybrid | 1 | easy | PASS | 0.653 | 78 | 6116 | 6194 | 992 | 308 | $0.00760 | Cited I.A |
| F-144-MC0 | hybrid | 2 | easy | PASS | 0.734 | 242 | 2764 | 3006 | 1326 | 88 | $0.00530 | Cited II.B |
| F-144-MC0 | hybrid | 3 | easy | PASS | 0.774 | 76 | 6265 | 6341 | 1012 | 337 | $0.00809 | Cited I.G |
| F-144-MC0 | hybrid | 4 | medium | PASS | 0.579 | 170 | 8320 | 8490 | 1518 | 396 | $0.01050 | Cited VII.B, VII.C |
| F-144-MC0 | hybrid | 5 | medium | PASS | 0.603 | 176 | 5146 | 5322 | 956 | 267 | $0.00687 | Cited VIII.R.1 |
| F-144-MC0 | hybrid | 6 | medium | PASS | 0.591 | 210 | 5125 | 5335 | 1149 | 218 | $0.00672 | Cited III.D.6.a |
| F-144-MC0 | hybrid | 7 | hard | PASS | 0.599 | 174 | 7082 | 7256 | 1442 | 322 | $0.00916 | Cited VIII.R.2.b |
| F-144-MC0 | hybrid | 8 | hard | PASS | 0.613 | 172 | 7545 | 7717 | 1004 | 353 | $0.00831 | Cited VIII.R.3 |
| F-144-MC0 | hybrid | 9 | hard | PASS | 0.519 | 196 | 3200 | 3396 | 1447 | 110 | $0.00599 | Cited V.D.5 |
| F-144-MC0 | hybrid | 10 | refusal | SEVERE | 0.460 | 110 | 2451 | 2561 | 988 | 70 | $0.00401 | must_refuse question received substantive answer |
