import assert from 'node:assert/strict'
import { LayoutPass, px, render_element, render_svg } from '@gum-jsx/core'
import { GeoMap, geojson, prepare_geo_source, us_states, world_countries } from '../../src'
import type { GeoMapProps } from '../../src'
import type { FeatureCollection, Geometry } from 'geojson'
import type { BenchmarkSetup } from './runner'

export const cases: Record<string, BenchmarkSetup> = {
  'maps/data/world-clone': () => () => world_countries(),
  'maps/data/states-clone': () => () => us_states(),
  'maps/data/filter-europe': () => () => world_countries({ ids: ['250', '276', '040', '756', '380'] }),
  'maps/prepare/world-topojson': () => {
    const source = world_countries()
    return () => prepare_geo_source(source)
  },
  'maps/prepare/states-topojson': () => {
    const source = us_states()
    return () => prepare_geo_source(source)
  },
  'maps/prepare/world-geojson': () => {
    const prepared = prepare_geo_source(world_countries())
    // These atlas features already have D3 winding. Conversion is setup only.
    const data: FeatureCollection<Geometry | null> = {
      type: 'FeatureCollection', features: prepared.features.map(item => item.feature),
    }
    const source = geojson(data, { winding: 'd3' })
    return () => prepare_geo_source(source)
  },
}

const workloads: Record<string, () => GeoMapProps> = {
  'world-natural-earth': () => ({ source: world_countries(), projection: 'naturalEarth1', fit_to: 'sphere' }),
  'world-orthographic': () => ({
    source: world_countries(), projection: 'orthographic', rotate: [-20, -25], fit_to: 'sphere',
  }),
  'states-albers': () => ({ source: us_states(), projection: 'albersUsa', fit_to: 'data' }),
  'europe-clipped': () => ({ source: world_countries(), projection: 'mercator', bounds: [-15, 35, 35, 65] }),
}

for (const [name, make] of Object.entries(workloads)) {
  cases[`maps/layout/${name}`] = () => {
    const element = new GeoMap({ ...make(), width: px(900), height: px(500), padding: px(10) })
    return () => new LayoutPass().layout(element)
  }
  cases[`maps/svg/${name}`] = () => {
    const { fragment, svg } = render_element(new GeoMap({ ...make(), width: px(900), height: px(500) }))
    assert.ok(svg.includes('<path') && fragment.size.width > 0)
    return () => render_svg(fragment)
  }
}

cases['maps/layout/world-prepared-resource'] = () => {
  const source = prepare_geo_source(world_countries())
  const element = new GeoMap({
    source_resource: 'geography', width: px(900), height: px(500), fit_to: 'sphere',
  })
  return () => new LayoutPass({ geography: { value: source, version: 1 } }).layout(element)
}
cases['maps/cache/world-hit'] = () => {
  const element = new GeoMap({ source: world_countries(), width: px(900), height: px(500) })
  const pass = new LayoutPass(), fragment = pass.layout(element)
  assert.equal(pass.layout(element), fragment)
  assert.ok(pass.stats.hits > 0)
  return () => pass.layout(element)
}
cases['maps/render/states-choropleth'] = () => {
  const source = us_states()
  return () => render_element(new GeoMap({
    source, width: px(900), height: px(500), projection: 'albersUsa', fit_to: 'data',
    border_mode: 'interior',
    styles: id => ({ fill: Number(id) % 2 ? '#3978b8' : '#d27038' }),
  }))
}
