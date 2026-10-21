# Trait-store benchmarks

Compare the actual filesystem store on `main` with this branch's SQLite-indexed
Markdown store. No model/API requests or live project trait mutations are
involved.

```sh
pnpm tasks bench --base main --rounds 7 --sizes real,1000
```

Runs directly as TypeScript on Node 24; no build or loader is needed.
`pnpm bench` is an alias for the same tasks command.

Results and generated fixtures are written under `/tmp/opencode/`. Use
`--output <fresh-directory>` to select a location. `main` must exist locally;
the runner does not fetch or modify it. Temporary baseline worktrees are removed
after the run. The real `.agents/traits` directory is only read.

## Method

This follows the checked-out Effect repository's approaches:

- `packages/sql/pg/benchmark/PgClient.ts` and
  `packages/effect/benchmark/Pool.ts`: asynchronous Tinybench tasks wrapping
  `Effect.runPromise`, separate setup/warmup, and `hrtimeNow` timestamps.
- `packages/effect/runtimeperf/README.md` and `stats.mts`: fresh worker
  processes, alternating implementation order, paired log ratios, and a
  deterministic 10,000-resample bootstrap. The statistics implementation was
  cross-checked against Effect's `analyzePairs` on fixed fixtures.

Effect's synchronous runtimeperf fixtures prohibit I/O, so their synchronous
batch runner is not used for these filesystem/database workloads.

Each dataset/implementation gets a fresh Node process in each round. Workers run
sequentially to avoid competing for CPU/I/O. A private copy of the same fixture
is used in every worker. Both revisions resolve the same installed runtime
dependencies; this isolates application changes rather than dependency updates.

The `real` fixture uses the current collection's normalized Markdown content.
Numeric sizes repeat its field/body distribution with unique names and a 5%
search marker. Full initial results are validated against the fixture; each
workload is checked before and after timing. Tinybench tasks explicitly set
`async: true` so its async detection cannot start overlapping mutation probes.

Defaults: 500 ms measurement, 150 ms warmup, at least one iteration per phase,
seven process pairs. Large filesystem scans can exceed the phase duration, so
some individual Tinybench tasks have few samples. **Independent processes are
the statistical observations**, not individual iterations. Raw p50/p99/RME
values are diagnostics, not independent confidence estimates.

## Workloads and costs

| Workload                    | Timed operation                                                            |
| --------------------------- | -------------------------------------------------------------------------- |
| `get`                       | Round-robin exact-name lookup                                              |
| `get-missing`               | Missing lookup, including expected error conversion                        |
| `ls`                        | Materialize the entire collection                                          |
| `list-filter`               | Existing `ls` + case-sensitive text filtering                              |
| `list-json`                 | `ls` + JSON serialization                                                  |
| `get-16-concurrent`         | Complete batch of 16 concurrent lookups, not one lookup                    |
| `update`                    | Back-to-back updates, including synchronous write-through                  |
| `add-remove-cycle`          | Add and remove one trait through the public store                          |
| `external-replace-visible`  | Atomic external Markdown replacement through visibility to a store query   |
| `update-read`               | Update followed immediately by a lookup                                    |
| `update-burst-16`           | Sequential updates of 16 distinct traits                                   |
| `external-burst-16-visible` | External atomic replacements of 16 traits through visibility of every edit |

Burst workloads use all available traits when a fixture contains fewer than 16.
The three additional workloads run after the original nine to retain their
measurement order. Burst timings are per complete batch, not per trait.

There is no current SQL full-text/semantic-search API. The filter benchmark does
not invent one, and storage improvements do not imply equivalent speedups for
model-backed checks.

Startup reports module import, layer construction/hydration, and first full list
separately. Their sum excludes Node launch, shared benchmark imports, fixture
copying, configuration/provider loading, package installation, MCP transport,
and the project ownership lock. Filesystem pages are warm; no OS cache flushing
is attempted.

RSS/heap deltas are approximate post-initialization observations without forced
GC, not precise retained-allocation measurements. SQLite file sizes include
present journal/WAL/SHM files. Historical results include a filesystem-only head
control; that diagnostic implementation has since been removed.

I/O counters count store-side Markdown reads, directory scans, and watch events
during warmup/measurement. They do not count SQLite's native filesystem I/O.
Background watcher work may extend beyond an individual API call's returned
latency; back-to-back write results reflect the observed scheduling, and the
external-replacement workload explicitly waits for visible synchronization.
Directory-scan counts reveal full catalog rebuilds after initial hydration;
normal incremental reconciliation should report zero scans.

## Output

- `raw.json`: environment, revisions, fixture sizes, and every worker result.
- `<fixture>-<variant>-<round>.json`: individual process observations.
- `comparison.json`: medians, paired head/base ratios, and 95% bootstrap
  intervals.

Ratios below one favor the branch. Printed speedups are reciprocals of the
paired median ratio; they may differ from simply dividing displayed medians.
Intervals are exploratory (seven pairs, no multiple-comparison adjustment).
Failed fixture assertions or workers fail the command; regressions remain
reported results rather than making the command fail.

Options: `--base`, `--rounds`, `--sizes`, `--time`, `--warmup`, `--iterations`,
and `--output`. Keep other heavy local jobs idle while measuring. Do not compare
absolute timings across machines or treat a short pilot as authoritative.
