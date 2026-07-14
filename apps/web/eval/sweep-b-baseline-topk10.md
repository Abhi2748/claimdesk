# Retrieval Lab v2 — Ablation Results

Run: 2026-07-14T22:53:43.852Z

Configs: `hybrid` | Docs: `F-122-ABLATION, F-123, F-144` | topK=10 pool=20

## Leaderboard (all docs combined)

| config | n | PASS | FAIL | SEVERE | p50 latency (ms) | p95 latency (ms) | p50 retrieval (ms) | avg cost/query | total cost |
|---|---|---|---|---|---|---|---|---|---|
| hybrid | 43 | 36 | 4 | 3 | 6422 | 9732 | 237 | $0.00801 | $0.34463 |

## By document x config

| doc | config | n | PASS | FAIL | SEVERE | p50 latency (ms) | avg cost/query |
|---|---|---|---|---|---|---|---|
| F-122-ABLATION | hybrid | 20 | 17 | 3 | 0 | 6471 | $0.00839 |
| F-123 | hybrid | 13 | 11 | 0 | 2 | 6165 | $0.00767 |
| F-144 | hybrid | 10 | 8 | 1 | 1 | 6379 | $0.00771 |

## All rows

| doc | config | id | difficulty | status | top_sim | retrieval_ms | gen_ms | total_ms | in_tok | out_tok | cost | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-122-ABLATION | hybrid | 1 | easy | PASS | 0.736 | 193 | 3059 | 3254 | 1335 | 78 | $0.00518 | Cited II.B |
| F-122-ABLATION | hybrid | 2 | easy | PASS | 0.726 | 142 | 6931 | 7073 | 1419 | 310 | $0.00891 | Cited II.C.2 |
| F-122-ABLATION | hybrid | 3 | easy | PASS | 0.677 | 259 | 6886 | 7145 | 1119 | 392 | $0.00924 | Cited III.A.3 |
| F-122-ABLATION | hybrid | 4 | easy | FAIL | 0.417 | 332 | 2459 | 2791 | 1871 | 58 | $0.00648 | Missing required cite: III.B.8 |
| F-122-ABLATION | hybrid | 5 | easy | PASS | 0.704 | 207 | 6994 | 7201 | 895 | 368 | $0.00821 | Cited VII.G.4 |
| F-122-ABLATION | hybrid | 6 | easy | PASS | 0.651 | 201 | 6221 | 6422 | 1750 | 317 | $0.01001 | Cited III.C.2.a |
| F-122-ABLATION | hybrid | 7 | medium | PASS | 0.648 | 283 | 6188 | 6471 | 1289 | 344 | $0.00903 | Cited III.D.2 |
| F-122-ABLATION | hybrid | 8 | medium | PASS | 0.560 | 194 | 7289 | 7483 | 1885 | 335 | $0.01068 | Cited III.C.2.b |
| F-122-ABLATION | hybrid | 9 | medium | PASS | 0.404 | 254 | 4659 | 4913 | 1643 | 184 | $0.00769 | Cited III.B.5 |
| F-122-ABLATION | hybrid | 10 | medium | FAIL | 0.565 | 222 | 4544 | 4766 | 1181 | 199 | $0.00653 | Missing required cite: VI.C |
| F-122-ABLATION | hybrid | 11 | medium | PASS | 0.684 | 251 | 11102 | 11354 | 1386 | 512 | $0.01184 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION | hybrid | 12 | medium | PASS | 0.554 | 322 | 5312 | 5634 | 1299 | 205 | $0.00697 | Cited VII.O |
| F-122-ABLATION | hybrid | 13 | medium | PASS | 0.520 | 481 | 3366 | 3847 | 1528 | 140 | $0.00668 | Cited IV.14 |
| F-122-ABLATION | hybrid | 14 | hard | PASS | 0.469 | 310 | 7965 | 8275 | 1315 | 349 | $0.00918 | Cited V.D.4, II.B |
| F-122-ABLATION | hybrid | 15 | hard | PASS | 0.524 | 822 | 8910 | 9732 | 1461 | 320 | $0.00918 | Cited V.D.5 |
| F-122-ABLATION | hybrid | 16 | hard | PASS | 0.528 | 327 | 9075 | 9402 | 1737 | 336 | $0.01025 | Cited V.C, II.C.20 |
| F-122-ABLATION | hybrid | 17 | hard | PASS | 0.606 | 471 | 4401 | 4872 | 1595 | 143 | $0.00693 | Cited V.A.5 |
| F-122-ABLATION | hybrid | 18 | hard | FAIL | 0.511 | 195 | 10046 | 10241 | 1562 | 388 | $0.01051 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION | hybrid | 19 | hard | PASS | 0.772 | 445 | 6860 | 7305 | 1583 | 316 | $0.00949 | Cited I.G |
| F-122-ABLATION | hybrid | 20 | refusal | PASS | 0.483 | 307 | 1338 | 1645 | 1550 | 12 | $0.00483 | Correct refusal |
| F-123 | hybrid | 1 | easy | PASS | 0.736 | 203 | 5511 | 5714 | 1306 | 87 | $0.00522 | Cited II.B |
| F-123 | hybrid | 2 | easy | PASS | 0.727 | 283 | 6033 | 6316 | 1245 | 271 | $0.00780 | Cited II.C.2 |
| F-123 | hybrid | 3 | easy | PASS | 0.673 | 222 | 9069 | 9291 | 1885 | 317 | $0.01041 | Cited III.C.2.a |
| F-123 | hybrid | 4 | easy | PASS | 0.642 | 237 | 4777 | 5014 | 1559 | 206 | $0.00777 | Cited III.C.1 |
| F-123 | hybrid | 5 | medium | PASS | 0.632 | 228 | 5937 | 6165 | 1355 | 288 | $0.00839 | Cited III.D.2 |
| F-123 | hybrid | 6 | medium | PASS | 0.624 | 227 | 4321 | 4548 | 958 | 198 | $0.00584 | Cited III.B.3 |
| F-123 | hybrid | 7 | medium | PASS | 0.590 | 264 | 4337 | 4601 | 1077 | 195 | $0.00616 | Cited III.B.8 |
| F-123 | hybrid | 8 | medium | PASS | 0.592 | 210 | 6628 | 6838 | 966 | 334 | $0.00791 | Cited III.B.1 |
| F-123 | hybrid | 9 | hard | PASS | 0.668 | 212 | 7166 | 7378 | 861 | 332 | $0.00756 | Cited I.A.2 |
| F-123 | hybrid | 10 | hard | PASS | 0.549 | 218 | 5550 | 5768 | 1300 | 207 | $0.00701 | Cited VII.O |
| F-123 | hybrid | 11 | hard | PASS | 0.540 | 253 | 8350 | 8603 | 1617 | 366 | $0.01034 | Cited V.D.5 |
| F-123 | hybrid | 12 | hard | SEVERE | 0.539 | 277 | 7211 | 7488 | 1481 | 316 | $0.00918 | Invented citation(s): II.B.1.C |
| F-123 | hybrid | 13 | refusal | SEVERE | 0.417 | 208 | 3250 | 3458 | 1719 | 64 | $0.00612 | must_refuse question received substantive answer |
| F-144 | hybrid | 1 | easy | PASS | 0.653 | 409 | 6599 | 7008 | 992 | 320 | $0.00778 | Cited I.A |
| F-144 | hybrid | 2 | easy | PASS | 0.734 | 197 | 3140 | 3337 | 1333 | 83 | $0.00524 | Cited II.B |
| F-144 | hybrid | 3 | easy | PASS | 0.774 | 67 | 6943 | 7010 | 1020 | 345 | $0.00824 | Cited I.G |
| F-144 | hybrid | 4 | medium | PASS | 0.579 | 237 | 7647 | 7884 | 1757 | 347 | $0.01048 | Cited VII.B, VII.C |
| F-144 | hybrid | 5 | medium | PASS | 0.603 | 264 | 6287 | 6551 | 956 | 311 | $0.00753 | Cited VIII.R.1 |
| F-144 | hybrid | 6 | medium | PASS | 0.591 | 185 | 5160 | 5345 | 1237 | 206 | $0.00680 | Cited III.D.6.a |
| F-144 | hybrid | 7 | hard | PASS | 0.599 | 196 | 5463 | 5659 | 1471 | 235 | $0.00794 | Cited VIII.R.2.b |
| F-144 | hybrid | 8 | hard | PASS | 0.613 | 255 | 6124 | 6379 | 1312 | 339 | $0.00902 | Cited VIII.R.3 |
| F-144 | hybrid | 9 | hard | FAIL | 0.519 | 201 | 7682 | 7883 | 1527 | 307 | $0.00919 | Missing required cite: V.D.5 |
| F-144 | hybrid | 10 | refusal | SEVERE | 0.460 | 221 | 3135 | 3356 | 1224 | 82 | $0.00490 | must_refuse question received substantive answer |
