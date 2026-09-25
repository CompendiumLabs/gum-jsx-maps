import { expect, test } from 'bun:test'
import { LayoutPass, px } from '@gum-jsx/core'
import type { FeatureCollection, Geometry, Point } from 'geojson'
import type { Topology } from 'topojson-specification'
import { GeoMap, geojson, prepare_geo_source, topojson, us_states, world_countries } from '../src'

test('bundled ID filters retain source order, local IDs, provenance, and shared borders', () => {
  const ids = ['040', '276', '040']
  const source = world_countries({ ids })
  const all = world_countries(), prepared = prepare_geo_source(source)
  expect(prepared.features.map(item => item.id)).toEqual(
    prepare_geo_source(all).features.filter(item => ids.includes(item.id)).map(item => item.id))
  expect(prepared.features).toHaveLength(2)
  expect(source.provenance).toEqual(all.provenance)
  expect(source.data.arcs).toEqual(all.data.arcs)
  expect(prepared.interior_borders?.type).toBe('MultiLineString')
  if (prepared.interior_borders?.type === 'MultiLineString') {
    expect(prepared.interior_borders.coordinates.length).toBeGreaterThan(0)
  }
  expect(prepare_geo_source(world_countries({ ids: ['local:kosovo'] })).features[0].id).toBe('local:kosovo')
  const states = prepare_geo_source(us_states({ ids: ['06', '32'] }))
  expect(states.features).toHaveLength(2)
  expect(states.by_id.get('06')?.feature.properties?.name).toBe('California')
  const single = prepare_geo_source(us_states({ ids: ['06'] }))
  expect(single.interior_borders).toEqual({ type: 'MultiLineString', coordinates: [] })
})

test('filtered copies are isolated and empty selections draw no features', () => {
  const ids = ['276']
  const source = world_countries({ ids })
  ids.push('040')
  expect(prepare_geo_source(source).features).toHaveLength(1)
  source.data.arcs[0][0][0] += 1
  expect(world_countries({ ids: ['276'] }).data.arcs[0][0][0]).not.toBe(source.data.arcs[0][0][0])
  expect(prepare_geo_source(world_countries()).features).toHaveLength(177)
  for (const accessor of [world_countries, us_states]) {
    const empty = accessor({ ids: [] })
    expect(prepare_geo_source(empty).features).toEqual([])
    const map = new LayoutPass().layout(new GeoMap({ source: empty, width: px(400), height: px(240) }))
    expect(map.draw).toEqual([])
    expect(() => new LayoutPass().layout(new GeoMap({ source: empty, fit_to: 'data' }))).toThrow('no geometry')
  }
})

test('source filters reject unknown or malformed IDs and retain exact padded strings', () => {
  expect(() => world_countries({ ids: ['Germany'] })).toThrow('Source feature "Germany" was not found')
  expect(() => us_states({ ids: ['6'] })).toThrow('was not found')
  expect(() => world_countries({ ids: [276] as unknown as string[] })).toThrow('array of strings')
  expect(() => world_countries({ ids: '276' as unknown as string[] })).toThrow('array of strings')
})

test('GeoJSON filters match feature IDs or id_property without mutating the input', () => {
  const data: FeatureCollection<Geometry | null> = { type: 'FeatureCollection', features: [
    { type: 'Feature', id: 10, properties: { code: 'A' }, geometry: { type: 'Point', coordinates: [0, 0] } },
    { type: 'Feature', id: 20, properties: { code: 'B' }, geometry: null },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [10, 10] } },
  ] }
  const before = structuredClone(data)
  const by_id = geojson(data, { ids: ['10'] })
  expect(prepare_geo_source(by_id).features.map(item => item.id)).toEqual(['10'])
  const by_property = geojson(data, { ids: ['B'], id_property: 'code', winding: 'd3' })
  expect(prepare_geo_source(by_property).features[0]).toMatchObject({ id: 'B', feature: { geometry: null } })
  expect(prepare_geo_source(geojson(data.features[0], { ids: ['10'] })).features).toHaveLength(1)
  expect(data).toEqual(before)
  expect(() => geojson(data, { ids: ['2'] })).toThrow('was not found') // No generated positional IDs.
  const point: Point = { type: 'Point', coordinates: [0, 0] }
  expect(() => geojson(point, { ids: ['0'] })).toThrow('was not found')
  expect(prepare_geo_source(geojson(point, { ids: [] })).features).toEqual([])
})

test('TopoJSON filters honor property IDs, single objects, and input ownership', () => {
  const data: Topology = { type: 'Topology', arcs: [], bbox: [-1, -1, 20, 20], objects: {
    points: { type: 'GeometryCollection', geometries: [
      { type: 'Point', id: 10, properties: { code: 'A' }, coordinates: [0, 0] },
      { type: 'Point', id: 20, properties: { code: 'B' }, coordinates: [10, 10] },
    ] },
    single: { type: 'Point', id: 'only', coordinates: [5, 5] },
  } }
  const before = structuredClone(data)
  const selected = topojson(data, 'points', { ids: ['B'], id_property: 'code' })
  expect(prepare_geo_source(selected).features.map(item => item.id)).toEqual(['B'])
  expect(selected.data.bbox).toBeUndefined()
  expect(prepare_geo_source(topojson(data, 'single', { ids: ['only'] })).features).toHaveLength(1)
  expect(data).toEqual(before)
  expect(() => topojson(data, 'absent', { ids: [] })).toThrow('was not found')
})

test('GeoMap draws and styles only selected features while bounds control the frame', () => {
  const source = world_countries({ ids: ['276', '040'] })
  const calls: string[] = []
  const map = new GeoMap({ source, width: px(500), height: px(300), bounds: [5, 45, 18, 56],
    border_mode: 'none', styles: id => { calls.push(id); return { fill: 'green' }; } })
  expect(new Set(calls)).toEqual(new Set(['276', '040']))
  expect(new LayoutPass().layout(map).draw).toHaveLength(2)
  expect(() => new LayoutPass().layout(new GeoMap({ source, fit_to: ['250'] }))).toThrow('was not found')
})
