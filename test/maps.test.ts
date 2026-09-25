import { describe, expect, test } from 'bun:test'
import { LayoutPass, Svg, THEMES, evaluate, px, render_element } from '@gum-jsx/core'
import { geoArea } from 'd3-geo'
import type { FeatureCollection, MultiPolygon } from 'geojson'
import type { Topology } from 'topojson-specification'
import {
  GeoMap, create_geo_projection, geojson, prepare_geo_source, project_geo_point, topojson, us_states,
} from '../src/index'

const countries: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'west', properties: { name: 'West' }, geometry: { type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] } },
    { type: 'Feature', id: 'east', properties: { name: 'East' }, geometry: { type: 'Polygon',
      coordinates: [[[10, 0], [20, 0], [20, 10], [10, 10], [10, 0]]] } },
  ],
}

// Two clockwise spherical rings share arc 2, traversed in opposite directions.
const topology: Topology = {
  type: 'Topology',
  objects: { countries: { type: 'GeometryCollection', geometries: [
    { type: 'Polygon', id: 'west', properties: { name: 'West' }, arcs: [[0, 1, 2, 3]] },
    { type: 'Polygon', id: 'east', properties: { name: 'East' }, arcs: [[4, 5, 6, ~2]] },
  ] } },
  arcs: [
    [[0, 0], [0, 10]], [[0, 10], [10, 10]], [[10, 10], [10, 0]], [[10, 0], [0, 0]],
    [[10, 10], [20, 10]], [[20, 10], [20, 0]], [[20, 0], [10, 0]],
  ],
}

describe('source conventions', () => {
  test('normalizes RFC outer rings and holes for spherical D3', () => {
    const polygon: FeatureCollection = { type: 'FeatureCollection', features: [{
      type: 'Feature', id: 'donut', properties: {}, geometry: { type: 'Polygon', coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[3, 3], [3, 7], [7, 7], [7, 3], [3, 3]],
      ] },
    }] }
    const source = geojson(polygon)
    const prepared = prepare_geo_source(source)
    const area = geoArea(prepared.features[0].feature)
    expect(area).toBeGreaterThan(0)
    expect(area).toBeLessThan(0.1)
    const map = new GeoMap({ source, width: px(400), height: px(240), fit_to: 'data', border_mode: 'none' })
    const result = render_element(map)
    expect(result.kind).toBe('svg')
    if (result.kind !== 'svg') return
    expect(result.svg.match(/M/g)?.length).toBe(2)
    expect(result.svg).not.toContain('NaN')
    // Inputs belong to the caller; normalization does not reverse their rings.
    expect(polygon.features[0].geometry?.type).toBe('Polygon')
    if (polygon.features[0].geometry?.type === 'Polygon') {
      expect(polygon.features[0].geometry.coordinates[0][1]).toEqual([10, 0])
    }
  })

  test('stitches RFC antimeridian cuts before projection', () => {
    const crossing: FeatureCollection = { type: 'FeatureCollection', features: [{
      type: 'Feature', id: 'crossing', properties: {}, geometry: { type: 'MultiLineString', coordinates: [
        [[170, 15], [180, 15]], [[-180, 15], [-170, 15]],
      ] },
    }] }
    const prepared = prepare_geo_source(geojson(crossing))
    expect(prepared.features[0].feature.geometry?.type).toBe('MultiLineString')
    const map = new GeoMap({ source: geojson(crossing), width: px(500), height: px(260), border_mode: 'all' })
    const result = render_element(map)
    expect(result.kind).toBe('svg')
    if (result.kind !== 'svg') return
    expect(result.svg).not.toContain('NaN')
    expect(result.svg.match(/<path /g)?.length).toBeGreaterThan(0)
    const split_geometry: MultiPolygon = { type: 'MultiPolygon', coordinates: [
      [[[180, 40], [180, 50], [170, 50], [170, 40], [180, 40]]],
      [[[-170, 40], [-170, 50], [-180, 50], [-180, 40], [-170, 40]]],
    ] }
    const split_polygon = geojson(split_geometry)
    const polygon = prepare_geo_source(split_polygon).features[0].feature
    expect(geoArea(polygon)).toBeLessThan(0.1)
    const polygon_result = render_element(new GeoMap({ source: split_polygon,
      width: px(500), height: px(260), border_mode: 'none' }))
    expect(polygon_result.kind).toBe('svg')
    if (polygon_result.kind === 'svg') expect(polygon_result.svg).not.toContain('NaN')
  })

  test('keeps TopoJSON shared borders as a single mesh drawing', () => {
    const source = topojson(topology, 'countries')
    const prepared = prepare_geo_source(source)
    expect(prepared.features.map(item => item.id)).toEqual(['west', 'east'])
    const result = render_element(new GeoMap({
      source, width: px(400), height: px(240), fit_to: 'data', border_mode: 'interior',
      styles: { west: { fill: '#ff0000', stroke: '#000000', stroke_width: px(2) }, east: { fill: '#0000ff' } },
    }))
    expect(result.kind).toBe('svg')
    if (result.kind !== 'svg') return
    const paths = result.fragment.children[0].fragment.draw.filter(item => item.kind === 'path')
    expect(paths).toHaveLength(4)
    expect(paths[2].stroke).toBe('#ffffff')
    expect(paths[2].fill).toBe('none')
    expect(paths[3].stroke).toBe('#000000')
    expect(paths[3].stroke_width).toBe(2)
    expect(paths[3].fill).toBe('none')
  })

  test('rejects ambiguous feature joins and unsupported interior edges', () => {
    expect(() => render_element(new GeoMap({ source: geojson(countries), width: px(400), height: px(240),
      styles: { missing: { fill: 'red' } } }))).toThrow('was not found')
    expect(() => render_element(new GeoMap({ source: geojson(countries), width: px(400), height: px(240),
      border_mode: 'interior' }))).toThrow('Interior borders require TopoJSON')
  })
})

describe('projected backgrounds', () => {
  test('draws a padded circular globe behind feature fills and borders', () => {
    const map = new LayoutPass().layout(new GeoMap({
      source: geojson(countries), width: px(400), height: px(240),
      projection: 'orthographic', rotate: [-10, -5], padding: px(16),
      background: 'blue', fill: 'green', border_color: 'white',
    }))
    const [background, ...features] = map.draw
    expect(background.kind).toBe('path')
    if (background.kind !== 'path') return
    expect(background.fill).toBe('blue')
    expect(background.stroke).toBe('none')
    expect(features.map(item => item.fill)).toEqual(['green', 'green', 'none', 'none'])
    expect(background.commands.at(-1)?.kind).toBe('Z')
    const vertices = background.commands.filter(command => command.kind === 'M' || command.kind === 'L')
    expect(vertices.length).toBeGreaterThan(4)
    for (const point of vertices) {
      // Every outline vertex lies on the globe, not on the surrounding rectangle.
      if (point.kind === 'M' || point.kind === 'L') {
        expect(Math.hypot(point.x - 200, point.y - 120)).toBeCloseTo(104, 5)
      }
    }
    expect(map.clip).toMatchObject({ x: 0, y: 0, width: 400, height: 240 })
  })

  test('defaults to transparent and resolves theme paint and opacity', () => {
    const pass = new LayoutPass()
    const props = { source: geojson(countries), width: px(400), height: px(240) }
    const plain = pass.layout(new GeoMap(props))
    expect(pass.layout(new GeoMap({ ...props, background: 'none' })).draw).toEqual(plain.draw)
    const themed = pass.layout(new GeoMap({
      ...props, theme: 'dark', background: 'theme:area', opacity: 0.4,
    }))
    expect(themed.draw).toHaveLength(plain.draw.length + 1)
    expect(themed.draw[0]).toMatchObject({ fill: THEMES.dark.area, opacity: 0.4, stroke_width: 0 })
  })

  for (const projection of ['naturalEarth1', 'equalEarth', 'orthographic', 'equirectangular', 'mercator', 'albersUsa'] as const) {
    test(`fills the ${projection} outline without changing feature geometry`, () => {
      const pass = new LayoutPass()
      const props = {
        source: projection === 'albersUsa' ? us_states() : geojson(countries),
        projection, width: px(400), height: px(240),
      }
      const plain = pass.layout(new GeoMap(props))
      const filled = pass.layout(new GeoMap({ ...props, background: 'blue' }))
      const background = filled.draw[0]
      expect(background.kind).toBe('path')
      if (background.kind !== 'path') return
      expect(background.commands.length).toBeGreaterThan(0)
      expect(background.bounds!.width).toBeGreaterThan(0)
      expect(background.bounds!.height).toBeGreaterThan(0)
      expect(filled.draw.slice(1)).toEqual([...plain.draw])
      expect(filled.size).toEqual(plain.size)
      expect(filled.clip).toEqual(plain.clip)
      if (projection === 'albersUsa') {
        expect(background.commands.filter(command => command.kind === 'M')).toHaveLength(3)
      }
    })
  }

  test('keeps regional fitting and viewport clipping when the sphere exceeds the map', () => {
    const pass = new LayoutPass()
    for (const fit_to of ['data', ['west']] as const) {
      const props = { source: geojson(countries), width: px(400), height: px(240), fit_to }
      const plain = pass.layout(new GeoMap(props))
      const filled = pass.layout(new GeoMap({ ...props, background: 'blue' }))
      expect(filled.draw.slice(1)).toEqual([...plain.draw])
      expect(filled.size).toEqual(plain.size)
      expect(filled.clip).toMatchObject({ x: 0, y: 0, width: 400, height: 240 })
      const background = filled.draw[0]
      expect(background.kind).toBe('path')
      if (background.kind === 'path') expect(background.bounds!.width).toBeGreaterThan(400)
    }
  })
})

describe('projection and Gum integration', () => {
  test('defaults maps and projection helpers to Natural Earth I', () => {
    const source = geojson(countries)
    const prepared = prepare_geo_source(source)
    const view = { projection: 'naturalEarth1' as const }
    const props = { source, width: px(400), height: px(240) }
    const default_map = render_element(new GeoMap(props))
    const natural_earth = render_element(new GeoMap({ ...props, ...view }))
    const equal_earth = render_element(new GeoMap({ ...props, projection: 'equalEarth' }))
    expect(default_map.kind).toBe('svg')
    expect(natural_earth.kind).toBe('svg')
    expect(equal_earth.kind).toBe('svg')
    if (default_map.kind !== 'svg' || natural_earth.kind !== 'svg' || equal_earth.kind !== 'svg') return
    expect(default_map.svg).toBe(natural_earth.svg)
    expect(default_map.svg).not.toBe(equal_earth.svg)

    const expected = create_geo_projection(prepared, view, 400, 240)([10, 10])
    expect(create_geo_projection(prepared, {}, 400, 240)([10, 10])).toEqual(expected)
    expect(project_geo_point(source, {}, 400, 240, [10, 10])).toEqual(expected)
  })

  test('fits selected geography and clips points behind an orthographic globe', () => {
    const prepared = prepare_geo_source(geojson(countries))
    const all = create_geo_projection(prepared, { fit_to: 'data' }, 200, 400)
    const west = create_geo_projection(prepared, { fit_to: ['west'] }, 200, 400)
    expect(west.scale()).toBeGreaterThan(all.scale())
    const globe = { projection: 'orthographic' as const, center: [0, 0] as const, fit_to: 'sphere' as const }
    expect(project_geo_point(prepared, globe, 400, 240, [0, 0])).not.toBeNull()
    expect(project_geo_point(prepared, globe, 400, 240, [180, 0])).toBeNull()
  })

  test('uses a pass resource and renders at the allocated size', () => {
    const pass = new LayoutPass({ world: { value: prepare_geo_source(geojson(countries)), version: 1 } })
    const map = new GeoMap({ source_resource: 'world', width: px(320), height: px(180),
      fit_to: 'data' })
    const result = render_element(new Svg({ width: px(320), height: px(180), children: map }), { pass })
    expect(result.kind).toBe('svg')
    if (result.kind !== 'svg') return
    expect(result.size).toEqual({ width: 320, height: 180 })
    expect(result.svg).not.toContain('NaN')
  })

  test('works in Gum JSX with host-provided scope and dashed attributes', () => {
    const world = topojson(topology, 'countries')
    const element = evaluate('<GeoMap source={world} width={px(320)} height={px(180)} fit-to="data" border-mode="interior" />',
      { scope: { GeoMap, world } })
    const result = render_element(element)
    expect(result.kind).toBe('svg')
    if (result.kind === 'svg') expect(result.svg).toContain('<path ')
  })
})
