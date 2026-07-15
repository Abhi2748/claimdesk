# Coverage agent COVERAGE_RETRIEVE_TOP_K ablation (12 vs 16 vs 20)

Run: 2026-07-15T04:20:46.520867+00:00

POOL fixed at 30 across all cells — topK is the single variable.

| topK | pool | PASS | FAIL | SEVERE | ERROR | p50 ms | p95 ms | draft_opinion p50 (s) | claim 2 (IV.5) | claim 3 (III.A.8) | est. output tokens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 12 | 30 | 7 | 3 | 0 | 0 | 21221 | 25436 | 18.3 | FAIL | FAIL | 1029 |
| 16 | 30 | 8 | 2 | 0 | 0 | 19446 | 25026 | 16.6 | FAIL | PASS | 1005 |
| 20 | 30 | 8 | 2 | 0 | 0 | 21409 | 31558 | 18.7 | FAIL | PASS | 1142 |

## Full row data per config


### topK=12

| id | status | verdict | latency_ms | notes |
|---|---|---|---|---|
| 1 | FAIL | partial | 25405 | verdict partial != expected covered; missing cite(s): ['III.A'] |
| 2 | FAIL | partial | 21221 | verdict partial != expected excluded; missing cite(s): ['IV.5'] |
| 3 | FAIL | partial | 22375 | missing cite(s): ['III.A.8'] |
| 4 | PASS | unclear | 13373 | OK |
| 5 | PASS | covered | 16751 | OK |
| 6 | PASS | excluded | 15570 | OK |
| 7 | PASS | partial | 21311 | OK |
| 8 | PASS | covered | 22897 | OK |
| 9 | PASS | excluded | 14295 | OK |
| 10 | PASS | partial | 25436 | OK |

### topK=16

| id | status | verdict | latency_ms | notes |
|---|---|---|---|---|
| 1 | FAIL | partial | 23243 | verdict partial != expected covered; missing cite(s): ['III.A'] |
| 2 | FAIL | partial | 19446 | verdict partial != expected excluded; missing cite(s): ['IV.5'] |
| 3 | PASS | partial | 17767 | OK |
| 4 | PASS | unclear | 13009 | OK |
| 5 | PASS | covered | 19472 | OK |
| 6 | PASS | excluded | 16691 | OK |
| 7 | PASS | partial | 21340 | OK |
| 8 | PASS | covered | 22345 | OK |
| 9 | PASS | excluded | 16750 | OK |
| 10 | PASS | partial | 25026 | OK |

### topK=20

| id | status | verdict | latency_ms | notes |
|---|---|---|---|---|
| 1 | FAIL | partial | 28099 | verdict partial != expected covered; missing cite(s): ['III.A'] |
| 2 | FAIL | partial | 20892 | verdict partial != expected excluded; missing cite(s): ['IV.5'] |
| 3 | PASS | partial | 20364 | OK |
| 4 | PASS | unclear | 18037 | OK |
| 5 | PASS | covered | 21409 | OK |
| 6 | PASS | excluded | 21514 | OK |
| 7 | PASS | partial | 29105 | OK |
| 8 | PASS | covered | 27085 | OK |
| 9 | PASS | excluded | 17022 | OK |
| 10 | PASS | partial | 31558 | OK |
