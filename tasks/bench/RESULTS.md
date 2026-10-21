# Initial comparison

These are historical measurements from before incremental reconciliation. The
current implementation reconciles changed files and keeps Markdown helpers
private inside the indexed store. A full seven-round comparison of the final
implementation is in progress; the figures below are not its results.

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
