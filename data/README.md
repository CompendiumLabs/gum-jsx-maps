# Bundled geography

These files ship with `@gum-jsx/maps`. The synchronous `world_countries()` and
`us_states()` accessors return ready-to-use TopoJSON sources without file loading
or network access. Each call copies the data and includes its source URL, version,
and boundary viewpoint in `provenance`.

The atlas downloads are kept byte-for-byte as published. `world_countries()`
fills three missing country IDs in its returned copy so every feature supports
ID-keyed feature styles:

| Feature name | Local ID |
| --- | --- |
| N. Cyprus | `local:northern-cyprus` |
| Somaliland | `local:somaliland` |
| Kosovo | `local:kosovo` |

| File | Source | SHA-256 |
| --- | --- | --- |
| `world-countries-110m.json` | [`world-atlas@2.0.2` countries-110m](https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json), based on Natural Earth country boundaries at 1:110m | `2516c915867c7baf18ddec727aec46c315541a07cfb3d79a6559b05d5e94eee8` |
| `us-states-10m.json` | [`us-atlas@3.0.1` states-10m](https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json), based on US Census state boundaries at 1:10m | `d76b391ccfa8bff601d51e3e3da5d43a89fa46cd5caca72ce731b383be5596d0` |

The atlas package license notices are included as
[`world-atlas-LICENSE`](world-atlas-LICENSE) and
[`us-atlas-LICENSE`](us-atlas-LICENSE). The synthetic polygon-with-hole and
antimeridian fixtures are defined directly in
[`geojson_edges.jsx` in the main docs gallery](https://github.com/CompendiumLabs/gum-jsx-docs/blob/master/docs/gallery/code/geojson_edges.jsx).

The source atlases are snapshots. Check their age, scale, and boundary viewpoint
before using them for any current or sensitive boundary claim.
