# Maps performance

```sh
bun run perf
bun run perf --list
bun run perf --filter 'maps/(prepare|layout)/'
bun run perf --smoke
bun run perf --json > /tmp/maps-perf.json
```

Run these from this repository after installing development dependencies. The
workspace root also provides `bun run --cwd gum-jsx-maps perf`; `bun run perf` runs all four
suites sequentially. Every command accepts the same flags. Filters are regular
expressions over full case names; unknown flags and filters with no matches fail.

All data comes from the bundled world 110m and US states 10m atlases. These
benchmarks perform no network requests, disk writes, or rasterization.

| Prefix | One measured operation |
| --- | --- |
| `maps/data/` | Clone an atlas through its public accessor, or clone and filter five European countries. |
| `maps/prepare/` | Prepare an existing source: convert features and, for TopoJSON, build border meshes. The GeoJSON input already has D3 winding. |
| `maps/layout/` | Create a fresh layout pass and lay out an existing map, including source preparation, projection fitting, clipping, and path creation. |
| `maps/svg/` | Serialize an already laid-out map fragment. |
| `maps/cache/` | Repeat the exact query on an already-populated layout pass. |
| `maps/render/` | Construct, lay out, and serialize a US choropleth with an ID-based style callback and interior borders; atlas cloning is outside timing. |

Layouts and SVG cases cover a Natural Earth world map, an orthographic globe,
Albers USA, and a Mercator map clipped to European bounds, each at 900 by 500
pixels. `world-prepared-resource` starts with a prepared source installed as a
resource on each fresh pass, isolating projection and path work from TopoJSON
preparation. Case names deliberately distinguish this from layout cache reuse.

Fixture setup is outside timing. Mitata supplies warmup, repeated sampling, and
latency distributions. `--list` skips setup; `--smoke` executes each selected
operation twice without timing. JSON reports contain nanosecond timings under
`benchmarks[].runs[].stats` (`avg`, `p50`, `p99`), with runtime and CPU information.
Compare the same cases on the same idle machine and Bun version, save Git
revisions with results, and repeat runs to check noise. Do not run tests, builds,
or other benchmarks concurrently. Timings are not correctness-test gates.

Add deterministic setup factories to `cases.ts` when extending the suite. Each
returns a synchronous function that returns its measured result. Keep the small
`runner.ts` CLI adapter identical in core, math, and maps; each repository carries
its own copy so it can run independently.
