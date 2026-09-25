# @gum-jsx/maps

Static projected maps for Gum JSX. The package accepts GeoJSON or TopoJSON,
projects geometry with `d3-geo`, and draws it through Gum's vector path system.
It does not fetch data while rendering.

For complete, offline figures, see the [runnable map examples](docs/README.md).

## Bundled geography

The package includes two small TopoJSON atlases, available without file loading
or network access:

| Accessor | Source | Feature IDs |
| --- | --- | --- |
| `world_countries()` | world-atlas 2.0.2, 1:110m countries | Three-digit country IDs, plus three stable local IDs |
| `us_states()` | us-atlas 3.0.1, 1:10m states and territories | Two-digit state FIPS IDs |

Each call returns a fresh `TopoJSONSource` with its version and source URL in
`provenance`. You can inspect or modify its `data` without affecting later calls.
See [bundled data](data/README.md) for the original files, licenses, and local IDs.

```ts
import { render_element, px } from '@gum-jsx/core'
import { GeoMap, world_countries } from '@gum-jsx/maps'

const world = world_countries()

const result = render_element(new GeoMap({
  source: world,
  width: px(900),
  height: px(500),
  projection: 'equalEarth',
  fit_to: 'sphere',
  map_padding: px(12),
  fill_by_id: { '840': '#4079ad' },
  border_color: '#ffffff',
  border_width: px(0.7),
  aria_label: 'World map',
}))

if (result.kind === 'svg') await Bun.write('world.svg', result.svg)
```

The CLI exposes the map elements and accessors through `--plugin @gum-jsx/maps`.
For example, save this as `world.jsx`:

```jsx
<GeoMap
  source={world_countries()}
  width={px(900)}
  height={px(500)}
  fill-by-id={{ '840': '#4079ad' }}
/>
```

Then run it from a project with `@gum-jsx/maps` installed:

```sh
gum world.jsx --plugin @gum-jsx/maps -o world.svg
```

Gum `.jsx` files use the plugin's exports directly, without package imports.
For an embedded evaluator, import the package with
`import * as maps from '@gum-jsx/maps'`, then construct
`new Evaluator({ scope: maps })`. In JSX, write dashed property names such as
`fill-by-id`, `fit-to`, and `map-padding`.

## Your own source

`geojson(data)` expects RFC 7946 longitude/latitude coordinates and winding by
default. It stitches antimeridian and polar cuts and changes polygon winding for
D3's spherical pipeline. Use `{ winding: 'd3' }` only for GeoJSON that already
uses D3/TopoJSON's convention. `topojson(data, objectName)` reads a named
Topology object and retains its shared arcs for one-pass borders.

Use the IDs present in your own source. The example key `840` is the numeric
ISO country ID used by some world TopoJSON files. `fill_by_id` rejects unknown
IDs, and all features must have explicit IDs when it is used. For GeoJSON whose
IDs live in properties, set `id_property`, for example
`geojson(data, { id_property: 'ADM0_A3' })`. Name matching is left to the data
preparation step.

## Projection and layout

| Preset | Good starting point |
| --- | --- |
| `equalEarth` (default) | World thematic maps with comparable areas |
| `naturalEarth1` | General world illustrations |
| `albersUsa` | United States with Alaska and Hawaii insets |
| `orthographic` | Globe views |
| `equirectangular` | Simple rectangular world views |
| `mercator` | Views where Mercator is specifically wanted |

The default fit target is `sphere`, except for `albersUsa`, which fits `data`.
Set `fit_to: 'data'` for a regional map or
`fit_to: { ids: ['feature-id'] }` for a stable selected extent. The fit target
does not depend on `fill_by_id`. Optional `center`, `rotate`, `clip_angle`, and
`precision` follow D3's degree/pixel conventions. `albersUsa` has fixed center,
rotation, and clipping; it excludes US territories beyond the lower 48 states,
Alaska, and Hawaii.

The map has a natural 720 px width and 1.8 aspect ratio. Explicit `width` and
`height` use ordinary Gum sizing. `map_padding`, `border_width`, and
`point_radius` use Gum lengths; `px()` makes the intended unit unambiguous.

For a point annotation, `project_geo_point(source, view, width, height,
[longitude, latitude])` returns local pixel coordinates or `null` if clipped.
Pass the same projection, fit target, and padding to this helper as to `GeoMap`.
The helper's `map_padding` value is a number of **pixels** because it does not
run within Gum layout.

## Borders and large sources

`border_mode` accepts `all` (default), `interior`, or `none`. With TopoJSON,
the chosen borders are drawn once from a shared-arc mesh. GeoJSON can draw all
feature edges, but adjacent edges are repeated; `interior` requires TopoJSON.
Fills are always drawn before borders. Points render as small circular paths.

One `GeoMap` owns one source. For a large source used in several maps, install
it once on a `LayoutPass` and pass `source_resource` rather than copying it into
each map's immutable props:

```ts
import { LayoutPass, render_element } from '@gum-jsx/core'
import { prepare_geo_source } from '@gum-jsx/maps'

const prepared = prepare_geo_source(world)
const pass = new LayoutPass({ geography: { value: prepared, version: '2026-09' } })
const result = render_element(new GeoMap({
  source_resource: 'geography',
  width: px(900),
  height: px(500),
}), { pass })
```

## Data preparation

For general world and regional illustrations, start with a versioned
[Natural Earth](https://www.naturalearthdata.com/downloads/) Admin 0 countries
or Admin 1 states/provinces dataset. Choose 110m for a small world locator,
50m for a page-sized map, or 10m for a detailed region. Record the scale,
release, boundary viewpoint, and original URL in `provenance`. Convert the
source to RFC 7946 GeoJSON or to geographic TopoJSON, preserving a stable ID
field. Inspect disputed boundaries against the source's stated viewpoint.

For current US state and county maps, the
[Census cartographic boundary files](https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html)
are another source. Prepare the files outside rendering and commit or pin the
result so a rerun uses the same geometry. Use topology-preserving simplification
when producing a compact TopoJSON file; projection precision is a separate
control for the curves generated at render time.
