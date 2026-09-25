import { expect, test } from 'bun:test'
import { LayoutPass, Line, Points, exact, make_request, px, render_svg } from '@gum-jsx/core'
import { rasterize_pixels } from '@gum-jsx/png'
import { geojson, prepare_geo_source, create_geo_projection, project_geo_point, GeoMap, world_countries } from '../src'
import type { FitTarget, GeoBounds, ProjectionName } from '../src'
import type { FeatureCollection, Polygon } from 'geojson'

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
const source = geojson(empty), prepared = prepare_geo_source(source)

test('coordinate bounds fit independently of source features and honor padding', () => {
  const bounds: GeoBounds = [-10, 35, 30, 60]
  const view = { projection: 'equirectangular' as const, bounds, padding: 10 }
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
  const projection = create_geo_projection(prepared, { bounds, padding: 20 }, 640, 600)
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
  const options = { projection: 'equirectangular' as const, bounds, padding: 10 }
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
    const fitted = create_geo_projection(prepared, { projection, bounds: [-180, -90, 180, 90] }, 640, 400)
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
    expect(() => create_geo_projection(prepared, { projection, bounds }, 640, 400)).toThrow('no visible extent')
  }
  const usa = create_geo_projection(prepared, { projection: 'albersUsa', bounds: [-125, 25, -66, 50] }, 640, 400)
  expect(usa.scale()).toBeGreaterThan(0)
  expect(usa([-100, 40])!.every(Number.isFinite)).toBe(true)
})

test('bounds views share fitting with child points, helpers, resizing, and center panning', () => {
  const point = [10, 48] as const
  const view = { bounds: [-10, 35, 30, 60] as GeoBounds, center: point, padding: 16 }
  const map = new GeoMap({ source, ...view, padding: px(16), background: 'blue',
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

test('invalid bounds and unsupported fit targets fail clearly', () => {
  const invalid = [[], [0, 0, 10], [0, 0, 0, 10], [180, 0, -180, 10],
    [-181, 0, 10, 20], [0, 0, 181, 20], [0, -91, 10, 20], [0, 0, 10, 91],
    [0, 10, 10, 10], [0, 20, 10, 10], [NaN, 0, 10, 20], [0, 0, Infinity, 20]]
  for (const bounds of invalid) {
    expect(() => create_geo_projection(prepared, { bounds: bounds as unknown as GeoBounds }, 640, 400)).toThrow(/bounds/)
  }
  for (const fit_to of [{}, { ids: [] }, { bounds: [0, 0, 10, 10] }, 'unknown', [276], ['276', null]]) {
    expect(() => create_geo_projection(prepared, { fit_to: fit_to as FitTarget }, 640, 400)).toThrow('Fit target')
  }
  expect(() => create_geo_projection(prepared, { fit_to: [] }, 640, 400)).toThrow('no geometry')
  expect(() => create_geo_projection(prepared, { fit_to: ['missing'] }, 640, 400)).toThrow('was not found')
})

test('bounds override all fit targets for natural size, geometry, and projected children', () => {
  const bounds: GeoBounds = [9, 40, 11, 60]
  const view = { projection: 'equirectangular' as const, bounds, padding: 0 }
  const props = { source, ...view, height: px(200), background: 'blue',
    children: new Points({ points: [[10, 50]], point_size: px(4) }) }
  const pass = new LayoutPass(), baseline = pass.layout(new GeoMap(props))
  expect(baseline.size.width).toBeCloseTo(20, 6)
  expect(baseline.size.height).toBe(200)
  const expected = create_geo_projection(prepared, view, 20, 200)
  // Empty data and missing IDs would fail without bounds, but are never used
  // when an explicit geographic box controls the view.
  for (const fit_to of ['sphere', 'data', ['missing'], []] as const) {
    const actual = pass.layout(new GeoMap({ ...props, fit_to }))
    expect(render_svg(actual)).toBe(render_svg(baseline))
    const projection = create_geo_projection(prepared, { ...view, fit_to }, 20, 200)
    expect(projection.scale()).toBe(expected.scale())
    expect(projection.translate()).toEqual(expected.translate())
    expect(project_geo_point(prepared, { ...view, fit_to }, 20, 200, [10, 50])).toEqual(expected([10, 50]))
  }
  const usa = { projection: 'albersUsa' as const, bounds: [-125, 25, -66, 50] as GeoBounds }
  expect(create_geo_projection(prepared, { ...usa, fit_to: 'sphere' }, 640, 400).scale())
    .toBe(create_geo_projection(prepared, usa, 640, 400).scale())
})

test('a narrow bounds view clips water, land, borders, and crossing child lines', () => {
  const polygon: Polygon = { type: 'Polygon', coordinates: [[
    [-30, 30], [40, 30], [40, 70], [-30, 70], [-30, 30],
  ]] }
  const land = geojson(polygon)
  for (const source of [geojson(empty), land]) {
    const fragment = new LayoutPass().layout(new GeoMap({ source,
      width: px(600), height: px(240), projection: 'equirectangular',
      bounds: [9, 40, 11, 60], padding: px(10),
      background: 'blue', fill: 'green', border_color: 'red', border_width: px(6),
      children: new Line({ space: 'data', from: [-10, 50], to: [30, 50],
        stroke: 'magenta', stroke_width: px(6) }),
    }))
    const pixels = rasterize_pixels(render_svg(fragment))
    const pixel = (x: number, y: number) => [...pixels.data.slice((y * pixels.width + x) * 4, (y * pixels.width + x + 1) * 4)]
    expect(pixel(300, 60)).toEqual(source === land ? [0, 128, 0, 255] : [0, 0, 255, 255])
    expect(pixel(300, 120)).toEqual([255, 0, 255, 255])
    // The 2° by 20° region has a 22 by 220 pixel footprint. The whole
    // crossing line survives inside the clip, even though both ends are outside.
    for (const x of [10, 280, 288, 311, 320, 590]) {
      for (const y of [10, 60, 120, 200, 230]) expect(pixel(x, y)[3]).toBe(0)
    }
    expect(fragment.ink!.width).toBeCloseTo(22, 6)
  }
})

test('bounds clips follow curved edges and both sides of an antimeridian crossing', () => {
  const cases = [
    { bounds: [-100, -60, 100, 60] as GeoBounds,
      inside: [[0, 0], [90, 55]], outside: [[110, 55], [-110, -55]] },
    { bounds: [170, -20, -170, 20] as GeoBounds,
      inside: [[175, 0], [-175, 0]], outside: [[0, 0], [160, 0], [-160, 0]] },
    { bounds: [170, -20, -170, 20] as GeoBounds, rotate: [-180, 0] as const,
      inside: [[175, 0], [-175, 0]], outside: [[160, 0], [-160, 0]] },
  ]
  for (const { inside, outside, ...view } of cases) {
    const fragment = new LayoutPass().layout(new GeoMap({ source, ...view,
      width: px(640), height: px(400), background: 'blue', padding: px(20) }))
    const pixels = rasterize_pixels(render_svg(fragment))
    const projection = create_geo_projection(prepared, { ...view, padding: 20 }, 640, 400)
    for (const [points, alpha] of [[inside, 255], [outside, 0]] as const) {
      for (const [lon, lat] of points) {
        const [x, y] = projection([lon, lat])!.map(Math.floor)
        // All probes are within the allocation: only the geographic clip
        // can hide the outside points, including those inside its bounding box.
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(640)
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(400)
        expect(pixels.data[(y * pixels.width + x) * 4 + 3]).toBe(alpha)
      }
    }
  }
})
