import { expect, test } from 'bun:test'
import { LayoutPass, Points, exact, make_request, px } from '@gum-jsx/core'
import { geojson, prepare_geo_source, create_geo_projection, project_geo_point, GeoMap, world_countries } from '../src'
import type { FitTarget, GeoBounds, ProjectionName } from '../src'
import type { FeatureCollection } from 'geojson'

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
const source = geojson(empty), prepared = prepare_geo_source(source)

test('coordinate bounds fit independently of source features and honor padding', () => {
  const bounds: GeoBounds = [-10, 35, 30, 60]
  const view = { projection: 'equirectangular' as const, fit_to: { bounds }, map_padding: 10 }
  const projection = create_geo_projection(prepared, view, 640, 400)
  expect(projection([-10, 60])![0]).toBeCloseTo(16, 6)
  expect(projection([-10, 60])![1]).toBeCloseTo(10, 6)
  expect(projection([30, 35])![0]).toBeCloseTo(624, 6)
  expect(projection([30, 35])![1]).toBeCloseTo(390, 6)
  const world = create_geo_projection(prepare_geo_source(world_countries()), view, 640, 400)
  expect(world.scale()).toBe(projection.scale())
  expect(world.translate()).toEqual(projection.translate())
})

test('curved edges and broad boxes contribute projected extrema beyond the four corners', () => {
  const bounds: GeoBounds = [-100, -60, 100, 60]
  const projection = create_geo_projection(prepared, { fit_to: { bounds }, map_padding: 20 }, 640, 600)
  const corner = projection([100, 60])!, equator = projection([100, 0])!
  expect(equator[0]).toBeGreaterThan(corner[0] + 30)
  expect(equator[0]).toBeCloseTo(620, 0)
  for (let latitude = -60; latitude <= 60; latitude += 5) {
    for (const longitude of [-100, 100]) {
      const [x, y] = projection([longitude, latitude])!
      expect(x).toBeGreaterThanOrEqual(19.5)
      expect(x).toBeLessThanOrEqual(620.5)
      expect(y).toBeGreaterThanOrEqual(19.5)
      expect(y).toBeLessThanOrEqual(580.5)
    }
  }
})

test('crossing bounds preserve the chosen projection seam and work with explicit rotation', () => {
  const bounds: GeoBounds = [170, -20, -170, 20]
  const options = { projection: 'equirectangular' as const, fit_to: { bounds }, map_padding: 10 }
  const split = create_geo_projection(prepared, options, 640, 400)
  const joined = create_geo_projection(prepared, { ...options, rotate: [-180, 0] }, 640, 400)
  expect(joined.scale()).toBeGreaterThan(split.scale() * 4)
  expect(joined([180, 0])![0]).toBeCloseTo(320, 6)
  expect(joined([180, 0])![1]).toBeCloseTo(200, 6)
  expect(joined([170, 20])![1]).toBeCloseTo(10, 4)
  expect(joined([-170, -20])![1]).toBeCloseTo(390, 4)
})

test('full longitude and pole bounds produce finite fits across world presets', () => {
  for (const projection of ['naturalEarth1', 'equalEarth', 'equirectangular', 'mercator', 'orthographic'] as const) {
    const fitted = create_geo_projection(prepared, { projection, fit_to: { bounds: [-180, -90, 180, 90] } }, 640, 400)
    const sphere = create_geo_projection(prepared, { projection }, 640, 400)
    expect(fitted.scale()).toBeCloseTo(sphere.scale(), 3)
    expect(fitted.translate()[0]).toBeCloseTo(sphere.translate()[0], 3)
    expect(fitted.translate()[1]).toBeCloseTo(sphere.translate()[1], 3)
  }
})

test('bounds fitting respects visibility and supports Albers USA regions', () => {
  const cases: [ProjectionName, GeoBounds][] = [
    ['orthographic', [140, -20, 160, 20]], ['albersUsa', [5, 40, 15, 50]],
  ]
  for (const [projection, bounds] of cases) {
    expect(() => create_geo_projection(prepared, { projection, fit_to: { bounds } }, 640, 400)).toThrow('no visible extent')
  }
  const usa = create_geo_projection(prepared, { projection: 'albersUsa', fit_to: { bounds: [-125, 25, -66, 50] } }, 640, 400)
  expect(usa.scale()).toBeGreaterThan(0)
  expect(usa([-100, 40])!.every(Number.isFinite)).toBe(true)
})

test('bounds views share fitting with child points, helpers, resizing, and center panning', () => {
  const point = [10, 48] as const
  const view = { fit_to: { bounds: [-10, 35, 30, 60] as GeoBounds }, center: point, map_padding: 16 }
  const map = new GeoMap({ source, ...view, map_padding: px(16), background: 'blue',
    children: new Points({ points: [point], point_size: px(8) }) })
  const pass = new LayoutPass()
  for (const [width, height] of [[640, 400], [320, 240]]) {
    const result = pass.layout(map, make_request({ width: exact(width), height: exact(height) }))
    const dot = result.children[0].fragment.children[0]
    expect(dot.offset.x + 4).toBeCloseTo(width / 2, 6)
    expect(dot.offset.y + 4).toBeCloseTo(height / 2, 6)
    const helper = project_geo_point(prepared, view, width, height, point)!
    expect(helper[0]).toBeCloseTo(width / 2, 6)
    expect(helper[1]).toBeCloseTo(height / 2, 6)
    expect(result.clip).toEqual({ x: 0, y: 0, width, height })
  }
})

test('invalid bounds and ambiguous fit targets fail clearly', () => {
  const invalid = [[], [0, 0, 10], [0, 0, 0, 10], [180, 0, -180, 10],
    [-181, 0, 10, 20], [0, 0, 181, 20], [0, -91, 10, 20], [0, 0, 10, 91],
    [0, 10, 10, 10], [0, 20, 10, 10], [NaN, 0, 10, 20], [0, 0, Infinity, 20]]
  for (const bounds of invalid) {
    expect(() => create_geo_projection(prepared, { fit_to: { bounds: bounds as unknown as GeoBounds } }, 640, 400)).toThrow(/bounds/)
  }
  for (const fit_to of [{}, { ids: [], bounds: [0, 0, 10, 10] }, 'unknown']) {
    expect(() => create_geo_projection(prepared, { fit_to: fit_to as FitTarget }, 640, 400)).toThrow('Fit target')
  }
})
