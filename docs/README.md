# Runnable map examples

Each `.jsx` file in [`examples/`](examples/) is a standalone Gum figure. It gets
its geography from the plugin's `world_countries()` or `us_states()` accessor,
or defines its own small GeoJSON source. Load `@gum-jsx/maps` through the CLI;
no prelude or custom data scope is needed.

After installing workspace dependencies, run from the `gum-jsx-maps` directory:

```sh
mkdir -p docs/out
bun ../gum-jsx-cli/src/cli.ts docs/examples/world_choropleth.jsx --plugin @gum-jsx/maps -o docs/out/world_choropleth.svg
bun ../gum-jsx-cli/src/cli.ts docs/examples/globe_markers.jsx --plugin @gum-jsx/maps -o docs/out/globe_markers.png
bun ../gum-jsx-cli/src/cli.ts docs/examples --plugin @gum-jsx/maps -o docs/out/maps.pdf
```

The directory command renders all six JSX figures into a PDF. With an installed
CLI, replace `bun ../gum-jsx-cli/src/cli.ts` with `gum`.

| Example | What it shows |
| --- | --- |
| [`world_choropleth.jsx`](examples/world_choropleth.jsx) | `world_countries()`, Equal Earth, ID-keyed fills, and one-pass shared borders |
| [`projection_gallery.jsx`](examples/projection_gallery.jsx) | Four projection presets on the same source and viewport |
| [`us_states.jsx`](examples/us_states.jsx) | `us_states()`, Albers USA insets, state FIPS IDs, and interior-only borders |
| [`globe_markers.jsx`](examples/globe_markers.jsx) | Orthographic clipping and `project_geo_point` overlays with matching view settings |
| [`selected_region.jsx`](examples/selected_region.jsx) | Selected-ID fitting, `prepare_geo_source`, and `create_geo_projection` for a custom route |
| [`geojson_edges.jsx`](examples/geojson_edges.jsx) | `geojson`, RFC ring winding and holes, antimeridian cuts, and `fit_to="data"` |

See [`../data/README.md`](../data/README.md) for source URLs, versions, hashes,
license notices, and the three stable local country IDs supplied by
`world_countries()`. The synthetic fixtures live directly in
[`geojson_edges.jsx`](examples/geojson_edges.jsx).
