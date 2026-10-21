# Trait-store benchmark results

## Final implementation: incremental reconciliation

Seven paired rounds completed successfully: 28 fresh workers, each validating
all 12 workloads. Node 24.18.0, Linux x64, three available Skylake vCPUs,
Tinybench 6.2.2; 500 ms measurement and 150 ms warmup per task.

Baseline: `d0ebd77` (main). Head: the working-tree implementation subsequently
committed as `cd20892`. The run began before that commit, so raw metadata
records `a24f94c` plus the tracked production diff. The real fixture contains 99
traits; the synthetic fixture contains 1,000. Both implementations use identical
fixtures within this run. Historical results below use an older baseline and
fixture, so before/after figures are descriptive, not a paired statistical
comparison.

Median process means, milliseconds:

| Operation                                 | Main, 99 | Indexed, 99 | Main, 1,000 | Indexed, 1,000 |
| ----------------------------------------- | -------: | ----------: | ----------: | -------------: |
| Startup + first list                      |  717.929 |   1,917.158 |   3,226.223 |      4,496.550 |
| Exact lookup                              |    2.351 |       0.683 |       2.252 |          0.558 |
| Missing lookup                            |    0.427 |       0.565 |       0.452 |          0.568 |
| Full list                                 |  267.630 |       2.848 |   2,461.795 |         23.445 |
| List + text filter                        |  269.657 |       2.835 |   2,425.707 |         25.840 |
| List + JSON                               |  257.846 |       3.983 |   2,442.466 |         26.628 |
| 16 concurrent lookups                     |   26.740 |       9.143 |      26.189 |          7.940 |
| Update                                    |    3.379 |      10.029 |       3.418 |         10.478 |
| Add/remove cycle                          |    3.481 |      15.566 |       3.253 |         14.375 |
| External replacement through visibility   |    3.407 |      13.279 |       2.916 |         11.984 |
| Update + immediate read                   |    5.496 |       9.074 |       5.301 |          9.855 |
| 16-update burst                           |   52.980 |     143.846 |      49.699 |        141.473 |
| 16-external-edit burst through visibility |   49.433 |      89.273 |      46.294 |         91.342 |

Paired median listing speedups were **89.75× / 100.90×**; paired head/main 95%
bootstrap intervals were **0.009–0.014 / 0.009–0.011**. Text filtering was
**91.93× / 92.11×** faster. Exact lookups improved **3.45× / 4.44×**.

All indexed workloads recorded **zero directory scans after hydration**, across
all seven rounds and both sizes. Updates remained around 10 ms and external-edit
visibility around 12–13 ms as the collection grew tenfold. The earlier
1,000-trait update and external-edit latencies were about 2.66–2.69 seconds:
ordinary changes now avoid full-catalog rebuilds. Burst timings likewise stayed
approximately flat with catalog size; they are per complete 16-operation batch.

There is still overhead: updates are roughly 3× slower than main, and startup
adds about 1.2–1.3 seconds. Using displayed medians, that startup premium pays
back after approximately **five additional listings at 99 traits, or one at
1,000**; exact lookups alone need roughly 720 / 750 requests. These are
read-only amortization estimates, excluding writes and model/network time.

Approximate post-initialization RSS deltas were 29.9 / 100.9 MiB (main/indexed,
99 traits) and 36.8 / 150.7 MiB (1,000). These are not retained-memory
measurements and include module loading and uncollected allocations. SQLite
occupied 110,592 / 913,408 bytes. Median indexed import time was 1.45 / 1.30
seconds, leaving module loading as a meaningful startup cost; this run does not
isolate schema creation from hydration. Importing the service-contract module
alone was separately verified not to load SQLite/Drizzle.

**Conclusion:** incremental reconciliation removes the catalog-size-dependent
write regression while retaining large collection-read gains. SQLite is valuable
for repeated reads, but it is not universally faster: writes, misses, startup
and memory still carry costs. See README for measurement limitations and
exploratory confidence intervals.

Final raw data:
`/tmp/opencode/traits-store-benchmark-final/{raw,comparison}.json` on the
measurement machine. Reproduce with:

```sh
pnpm tasks bench --base main --rounds 7 --sizes real,1000
```

## Historical comparison: before incremental reconciliation

Measured `49419d2` (main) against `a24f94c` on Node 24.18.0, Linux x64, three
available Skylake vCPUs, Tinybench 6.2.2. Seven paired fresh-process rounds, 500
ms measurement / 150 ms warmup. See README for limitations. These measurements
used the original JavaScript harness before its TypeScript conversion; the typed
harness was separately smoke-tested, not fully remeasured.

Median process means in milliseconds (speedups use paired ratios):

| Operation                               | Main, 97 traits | SQLite, 97 | Speedup | Main, 1,000 | SQLite, 1,000 | Speedup |
| --------------------------------------- | --------------: | ---------: | ------: | ----------: | ------------: | ------: |
| Startup + first list                    |             909 |      1,961 |   0.48× |       3,201 |         4,646 |   0.71× |
| Exact lookup                            |           2.801 |      0.783 |   3.72× |       2.600 |         0.545 |   4.98× |
| Full list                               |         269.506 |      3.191 |  87.96× |   2,463.500 |        22.988 | 106.89× |
| List + text filter                      |         277.627 |      2.849 |  97.45× |   2,647.825 |        22.722 | 112.29× |
| Update                                  |           3.252 |     21.777 |   0.14× |       3.562 |     2,664.455 | 0.0013× |
| Add/remove cycle                        |           3.111 |     14.092 |   0.21× |       3.572 |        14.388 |   0.25× |
| External replacement through visibility |           2.935 |    266.142 |  0.011× |       3.658 |     2,688.364 | 0.0014× |

For full lists, paired head/main 95% bootstrap intervals were 0.010–0.016 (97
traits) and 0.009–0.011 (1,000): a large read benefit across processes.

Using displayed medians, startup overhead pays back after approximately four
additional full listings at 97 traits, or one at 1,000. Exact lookups alone need
roughly 522 / 704 additional requests. This ignores writes, model/network time,
and synchronization: it is a read-only amortization estimate, not an end-to-end
agent speedup.

**Conclusion:** SQLite justifies its cost for repeated collection reads, but the
current write/synchronization path has a serious scaling regression.
Store-originated filesystem notifications can provoke full rebuilds after
write-through; scheduling makes the cost workload-dependent. The update and
external-change results warrant fixing this before claiming a general win. The
filesystem-only head control retains broadly similar read performance to main,
while also paying eager SQLite/Drizzle module-import overhead.

Raw results, per-process measurements, I/O counters, memory observations and
confidence intervals remain in
`/tmp/opencode/traits-store-benchmark-a24f94c/{raw,comparison}.json` on the
measurement machine. They are not checked into the repository.
