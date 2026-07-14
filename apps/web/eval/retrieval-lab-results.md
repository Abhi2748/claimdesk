# Retrieval Lab v2 — Ablation Results

Run: 2026-07-14T22:22:05.352Z

Configs: `dense, hybrid` | Docs: `F-122-ABLATION, F-123, F-144` | topK=6 pool=20

## Leaderboard (all docs combined)

| config | n | PASS | FAIL | SEVERE | p50 latency (ms) | p95 latency (ms) | p50 retrieval (ms) | avg cost/query | total cost |
|---|---|---|---|---|---|---|---|---|---|
| dense | 43 | 32 | 7 | 4 | 6227 | 8701 | 213 | $0.00643 | $0.27640 |
| hybrid | 43 | 34 | 6 | 3 | 6178 | 8922 | 204 | $0.00658 | $0.28298 |

## By document x config

| doc | config | n | PASS | FAIL | SEVERE | p50 latency (ms) | avg cost/query |
|---|---|---|---|---|---|---|---|
| F-122-ABLATION | dense | 20 | 15 | 4 | 1 | 6486 | $0.00661 |
| F-122-ABLATION | hybrid | 20 | 16 | 4 | 0 | 6987 | $0.00678 |
| F-123 | dense | 13 | 11 | 0 | 2 | 5007 | $0.00642 |
| F-123 | hybrid | 13 | 10 | 1 | 2 | 5666 | $0.00655 |
| F-144 | dense | 10 | 6 | 3 | 1 | 5834 | $0.00608 |
| F-144 | hybrid | 10 | 8 | 1 | 1 | 5025 | $0.00623 |

## All rows

| doc | config | id | difficulty | status | top_sim | retrieval_ms | gen_ms | total_ms | in_tok | out_tok | cost | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-122-ABLATION | dense | 1 | easy | PASS | 0.736 | 199 | 2619 | 2820 | 775 | 79 | $0.00351 | Cited II.B |
| F-122-ABLATION | hybrid | 1 | easy | PASS | 0.736 | 110 | 2374 | 2484 | 1089 | 70 | $0.00432 | Cited II.B |
| F-122-ABLATION | dense | 2 | easy | PASS | 0.726 | 87 | 3821 | 3908 | 600 | 108 | $0.00342 | Cited II.C.2 |
| F-122-ABLATION | hybrid | 2 | easy | PASS | 0.726 | 306 | 1696 | 2002 | 600 | 65 | $0.00278 | Cited II.C.2 |
| F-122-ABLATION | dense | 3 | easy | PASS | 0.677 | 79 | 6574 | 6653 | 777 | 331 | $0.00730 | Cited III.A.3 |
| F-122-ABLATION | hybrid | 3 | easy | PASS | 0.677 | 249 | 7938 | 8187 | 842 | 335 | $0.00755 | Cited III.A.3 |
| F-122-ABLATION | dense | 4 | easy | FAIL | 0.417 | 229 | 2452 | 2681 | 1075 | 12 | $0.00341 | Missing required cite: III.B.8 |
| F-122-ABLATION | hybrid | 4 | easy | FAIL | 0.417 | 190 | 3845 | 4035 | 896 | 134 | $0.00470 | Missing required cite: III.B.8 |
| F-122-ABLATION | dense | 5 | easy | PASS | 0.704 | 224 | 8477 | 8701 | 596 | 345 | $0.00696 | Cited VII.G.4 |
| F-122-ABLATION | hybrid | 5 | easy | PASS | 0.704 | 217 | 8357 | 8574 | 648 | 337 | $0.00700 | Cited VII.G.4 |
| F-122-ABLATION | dense | 6 | easy | PASS | 0.651 | 240 | 8345 | 8585 | 1581 | 321 | $0.00956 | Cited III.C.2.a |
| F-122-ABLATION | hybrid | 6 | easy | PASS | 0.651 | 420 | 6566 | 6986 | 1582 | 331 | $0.00971 | Cited III.C.2.a |
| F-122-ABLATION | dense | 7 | medium | PASS | 0.648 | 421 | 6852 | 7273 | 1048 | 352 | $0.00842 | Cited III.D.2 |
| F-122-ABLATION | hybrid | 7 | medium | PASS | 0.648 | 324 | 6663 | 6987 | 706 | 349 | $0.00735 | Cited III.D.2 |
| F-122-ABLATION | dense | 8 | medium | PASS | 0.560 | 376 | 6964 | 7340 | 1173 | 341 | $0.00863 | Cited III.C.2.b |
| F-122-ABLATION | hybrid | 8 | medium | PASS | 0.560 | 201 | 8251 | 8452 | 1347 | 334 | $0.00905 | Cited III.C.2.b |
| F-122-ABLATION | dense | 9 | medium | PASS | 0.404 | 204 | 5409 | 5613 | 1308 | 198 | $0.00689 | Cited III.B.5 |
| F-122-ABLATION | hybrid | 9 | medium | PASS | 0.404 | 224 | 4276 | 4500 | 1171 | 164 | $0.00597 | Cited III.B.5 |
| F-122-ABLATION | dense | 10 | medium | FAIL | 0.565 | 235 | 3957 | 4192 | 588 | 108 | $0.00338 | Missing required cite: VI.C |
| F-122-ABLATION | hybrid | 10 | medium | FAIL | 0.565 | 344 | 9264 | 9608 | 780 | 158 | $0.00471 | Missing required cite: VI.C |
| F-122-ABLATION | dense | 11 | medium | PASS | 0.684 | 243 | 7227 | 7470 | 907 | 363 | $0.00817 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION | hybrid | 11 | medium | PASS | 0.684 | 240 | 7534 | 7774 | 918 | 400 | $0.00875 | Cited VII.R.1.a, VII.R.4 |
| F-122-ABLATION | dense | 12 | medium | PASS | 0.554 | 213 | 5006 | 5219 | 796 | 203 | $0.00543 | Cited VII.O |
| F-122-ABLATION | hybrid | 12 | medium | PASS | 0.554 | 209 | 3783 | 3992 | 838 | 192 | $0.00539 | Cited VII.O |
| F-122-ABLATION | dense | 13 | medium | FAIL | 0.520 | 244 | 6299 | 6543 | 1192 | 231 | $0.00704 | Missing required cite: IV.14 |
| F-122-ABLATION | hybrid | 13 | medium | PASS | 0.520 | 205 | 3779 | 3984 | 1467 | 140 | $0.00650 | Cited IV.14 |
| F-122-ABLATION | dense | 14 | hard | PASS | 0.469 | 178 | 6308 | 6486 | 893 | 257 | $0.00653 | Cited V.D.4, II.B |
| F-122-ABLATION | hybrid | 14 | hard | PASS | 0.469 | 194 | 7199 | 7393 | 974 | 309 | $0.00756 | Cited V.D.4, II.B |
| F-122-ABLATION | dense | 15 | hard | PASS | 0.524 | 202 | 6247 | 6449 | 1191 | 270 | $0.00762 | Cited V.D.5 |
| F-122-ABLATION | hybrid | 15 | hard | PASS | 0.524 | 205 | 7468 | 7673 | 1026 | 344 | $0.00824 | Cited V.D.5 |
| F-122-ABLATION | dense | 16 | hard | SEVERE | 0.528 | 199 | 8501 | 8701 | 1093 | 370 | $0.00883 | Invented citation(s): II.B.1.C |
| F-122-ABLATION | hybrid | 16 | hard | FAIL | 0.528 | 199 | 8723 | 8922 | 1589 | 325 | $0.00964 | Missing required cite: V.C, II.C.20 |
| F-122-ABLATION | dense | 17 | hard | PASS | 0.606 | 242 | 6106 | 6348 | 1025 | 215 | $0.00630 | Cited V.A.5 |
| F-122-ABLATION | hybrid | 17 | hard | PASS | 0.606 | 183 | 4351 | 4534 | 980 | 156 | $0.00528 | Cited V.A.5 |
| F-122-ABLATION | dense | 18 | hard | FAIL | 0.511 | 213 | 9717 | 9930 | 1220 | 353 | $0.00896 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION | hybrid | 18 | hard | FAIL | 0.511 | 229 | 8117 | 8346 | 927 | 344 | $0.00794 | Missing required cite: III.A.8, III.B.5 |
| F-122-ABLATION | dense | 19 | hard | PASS | 0.772 | 198 | 7230 | 7428 | 1102 | 338 | $0.00838 | Cited I.G |
| F-122-ABLATION | hybrid | 19 | hard | PASS | 0.772 | 350 | 9153 | 9503 | 1193 | 373 | $0.00917 | Cited I.G |
| F-122-ABLATION | dense | 20 | refusal | PASS | 0.483 | 250 | 1185 | 1435 | 1062 | 12 | $0.00337 | Correct refusal |
| F-122-ABLATION | hybrid | 20 | refusal | PASS | 0.483 | 127 | 1418 | 1545 | 1236 | 12 | $0.00389 | Correct refusal |
| F-123 | dense | 1 | easy | PASS | 0.736 | 159 | 2913 | 3072 | 772 | 76 | $0.00346 | Cited II.B |
| F-123 | hybrid | 1 | easy | PASS | 0.736 | 181 | 2691 | 2872 | 1043 | 81 | $0.00434 | Cited II.B |
| F-123 | dense | 2 | easy | PASS | 0.727 | 125 | 4856 | 4981 | 829 | 231 | $0.00595 | Cited II.C.2 |
| F-123 | hybrid | 2 | easy | PASS | 0.727 | 183 | 5483 | 5666 | 765 | 208 | $0.00542 | Cited II.C.2 |
| F-123 | dense | 3 | easy | PASS | 0.673 | 182 | 6909 | 7092 | 1306 | 335 | $0.00894 | Cited III.C.2.a |
| F-123 | hybrid | 3 | easy | PASS | 0.673 | 199 | 8198 | 8397 | 1614 | 334 | $0.00985 | Cited III.C.2.a |
| F-123 | dense | 4 | easy | PASS | 0.642 | 189 | 3862 | 4051 | 1335 | 150 | $0.00626 | Cited III.C.1 |
| F-123 | hybrid | 4 | easy | PASS | 0.642 | 174 | 3983 | 4157 | 1216 | 161 | $0.00606 | Cited III.C.1 |
| F-123 | dense | 5 | medium | PASS | 0.632 | 273 | 6731 | 7004 | 1005 | 361 | $0.00843 | Cited III.D.2 |
| F-123 | hybrid | 5 | medium | PASS | 0.632 | 194 | 5261 | 5455 | 1005 | 272 | $0.00710 | Cited III.D.2 |
| F-123 | dense | 6 | medium | PASS | 0.624 | 227 | 3452 | 3679 | 648 | 135 | $0.00397 | Cited III.B.3 |
| F-123 | hybrid | 6 | medium | PASS | 0.624 | 80 | 5633 | 5713 | 621 | 240 | $0.00546 | Cited III.B.3 |
| F-123 | dense | 7 | medium | PASS | 0.590 | 180 | 4069 | 4249 | 617 | 177 | $0.00451 | Cited III.B.8 |
| F-123 | hybrid | 7 | medium | PASS | 0.590 | 245 | 3703 | 3948 | 617 | 170 | $0.00440 | Cited III.B.8 |
| F-123 | dense | 8 | medium | PASS | 0.592 | 272 | 7983 | 8255 | 648 | 392 | $0.00782 | Cited III.B.1 |
| F-123 | hybrid | 8 | medium | FAIL | 0.592 | 204 | 7821 | 8025 | 671 | 381 | $0.00773 | Missing required cite: III.B.1 |
| F-123 | dense | 9 | hard | PASS | 0.668 | 177 | 6877 | 7054 | 586 | 297 | $0.00621 | Cited I.A.2 |
| F-123 | hybrid | 9 | hard | PASS | 0.668 | 258 | 6193 | 6451 | 562 | 309 | $0.00632 | Cited I.A.2 |
| F-123 | dense | 10 | hard | PASS | 0.549 | 197 | 4810 | 5007 | 798 | 232 | $0.00587 | Cited VII.O |
| F-123 | hybrid | 10 | hard | PASS | 0.549 | 184 | 4635 | 4820 | 930 | 224 | $0.00615 | Cited VII.O |
| F-123 | dense | 11 | hard | PASS | 0.540 | 269 | 8370 | 8639 | 1214 | 348 | $0.00886 | Cited V.D.5 |
| F-123 | hybrid | 11 | hard | PASS | 0.540 | 183 | 7793 | 7976 | 1139 | 386 | $0.00921 | Cited V.D.5 |
| F-123 | dense | 12 | hard | SEVERE | 0.539 | 219 | 8856 | 9075 | 1021 | 357 | $0.00842 | Invented citation(s): II.B.1.C |
| F-123 | hybrid | 12 | hard | SEVERE | 0.539 | 193 | 8059 | 8252 | 943 | 342 | $0.00796 | Invented citation(s): II.B.1.C |
| F-123 | dense | 13 | refusal | SEVERE | 0.417 | 194 | 2673 | 2867 | 1287 | 59 | $0.00475 | must_refuse question received substantive answer |
| F-123 | hybrid | 13 | refusal | SEVERE | 0.417 | 205 | 3233 | 3438 | 1395 | 64 | $0.00515 | must_refuse question received substantive answer |
| F-144 | dense | 1 | easy | FAIL | 0.653 | 407 | 5792 | 6199 | 533 | 278 | $0.00577 | Missing required cite: I.A |
| F-144 | hybrid | 1 | easy | PASS | 0.653 | 204 | 5974 | 6178 | 717 | 282 | $0.00638 | Cited I.A |
| F-144 | dense | 2 | easy | PASS | 0.734 | 229 | 2364 | 2593 | 786 | 75 | $0.00348 | Cited II.B |
| F-144 | hybrid | 2 | easy | PASS | 0.734 | 78 | 2992 | 3070 | 1051 | 105 | $0.00473 | Cited II.B |
| F-144 | dense | 3 | easy | PASS | 0.774 | 79 | 7599 | 7678 | 745 | 331 | $0.00720 | Cited I.G |
| F-144 | hybrid | 3 | easy | PASS | 0.774 | 205 | 7371 | 7576 | 858 | 341 | $0.00769 | Cited I.G |
| F-144 | dense | 4 | medium | PASS | 0.579 | 205 | 6022 | 6227 | 1100 | 337 | $0.00836 | Cited VII.B, VII.C |
| F-144 | hybrid | 4 | medium | PASS | 0.579 | 181 | 7736 | 7917 | 1089 | 388 | $0.00909 | Cited VII.B, VII.C |
| F-144 | dense | 5 | medium | PASS | 0.603 | 227 | 5607 | 5834 | 719 | 295 | $0.00658 | Cited VIII.R.1 |
| F-144 | hybrid | 5 | medium | PASS | 0.603 | 182 | 4745 | 4927 | 605 | 235 | $0.00534 | Cited VIII.R.1 |
| F-144 | dense | 6 | medium | PASS | 0.591 | 190 | 5127 | 5317 | 894 | 194 | $0.00559 | Cited III.D.6.a |
| F-144 | hybrid | 6 | medium | PASS | 0.591 | 247 | 4729 | 4976 | 577 | 188 | $0.00455 | Cited III.D.6.a |
| F-144 | dense | 7 | hard | FAIL | 0.599 | 209 | 8178 | 8387 | 857 | 330 | $0.00752 | Missing required cite: VIII.R.2.b |
| F-144 | hybrid | 7 | hard | PASS | 0.599 | 243 | 4782 | 5025 | 952 | 203 | $0.00590 | Cited VIII.R.2.b |
| F-144 | dense | 8 | hard | PASS | 0.613 | 203 | 5816 | 6019 | 927 | 327 | $0.00769 | Cited VIII.R.3 |
| F-144 | hybrid | 8 | hard | PASS | 0.613 | 214 | 6560 | 6774 | 830 | 338 | $0.00756 | Cited VIII.R.3 |
| F-144 | dense | 9 | hard | FAIL | 0.519 | 238 | 4025 | 4263 | 1209 | 119 | $0.00541 | Missing required cite: V.D.5 |
| F-144 | hybrid | 9 | hard | FAIL | 0.519 | 243 | 7477 | 7721 | 1320 | 246 | $0.00765 | Missing required cite: V.D.5 |
| F-144 | dense | 10 | refusal | SEVERE | 0.460 | 495 | 2460 | 2955 | 793 | 56 | $0.00322 | must_refuse question received substantive answer |
| F-144 | hybrid | 10 | refusal | SEVERE | 0.460 | 204 | 2663 | 2868 | 777 | 73 | $0.00343 | must_refuse question received substantive answer |
