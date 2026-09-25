import { expect, test } from 'bun:test'
import { LayoutPass, px } from '@gum-jsx/core'
import type { FeatureCollection } from 'geojson'
import {
  GeoMap, create_geo_projection, geojson, prepare_geo_source, project_geo_point, us_states,
} from '../src'

const data: FeatureCollection = { type: 'FeatureCollection', features: [
  { type: 'Feature', id: 'region', properties: {}, geometry: { type: 'Polygon',
    coordinates: [[[20, 10], [50, 10], [50, 30], [20, 30], [20, 10]]] } },
] }
const source = geojson(data)
const prepared = prepare_geo_source(source)

for (const projection of ['naturalEarth1', 'equalEarth', 'orthographic', 'equirectangular', 'mercator'] as const) {
  test(`${projection} centers the requested location after fitting`, () => {
    for (const fit_to of ['sphere', 'data', { ids: ['region'] }] as const) {
      for (const [width, height] of [[640, 400], [300, 500]]) {
        const view = { projection, fit_to, map_padding: 20 }
        const fitted = create_geo_projection(prepared, view, width, height)
        const centered = create_geo_projection(prepared, { ...view, center: [30, 20] }, width, height)
        const point = centered([30, 20])!
        expect(point[0]).toBeCloseTo(width / 2, 6)
        expect(point[1]).toBeCloseTo(height / 2, 6)
        expect(centered.scale()).toBeCloseTo(fitted.scale(), 6)
        const marker = project_geo_point(source, { ...view, center: [30, 20] }, width, height, [30, 20])!
        expect(marker[0]).toBeCloseTo(width / 2, 6)
        expect(marker[1]).toBeCloseTo(height / 2, 6)
      }
    }
  })
}

test('an explicit origin overrides the automatic center of a regional fit', () => {
  const view = { fit_to: 'data' as const }
  const fitted = create_geo_projection(prepared, view, 640, 400)
  const centered = create_geo_projection(prepared, { ...view, center: [0, 0] }, 640, 400)
  expect(fitted([0, 0])![0]).not.toBeCloseTo(320, 6)
  expect(centered([0, 0])![0]).toBeCloseTo(320, 6)
  expect(centered([0, 0])![1]).toBeCloseTo(200, 6)
  expect(centered.scale()).toBeCloseTo(fitted.scale(), 6)
})

test('centering works in geographic coordinates with rotation and preserves globe clipping', () => {
  const center = [30, 20] as const
  const view = { projection: 'orthographic' as const, center, rotate: [-15, -10, 20] as const }
  const projection = create_geo_projection(prepared, view, 640, 400)
  expect(projection([...center])![0]).toBeCloseTo(320, 6)
  expect(projection([...center])![1]).toBeCloseTo(200, 6)
  expect(project_geo_point(source, view, 640, 400, [-150, -20])).toBeNull()
  // Panning does not turn a point on the far side toward the viewer.
  expect(project_geo_point(source, { projection: 'orthographic', center: [180, 0] },
    640, 400, [180, 0])).toBeNull()
})

test('GeoMap pans its features and background together and keeps the viewport clip', () => {
  const pass = new LayoutPass()
  const props = { source, width: px(640), height: px(400), background: 'blue' }
  const plain = pass.layout(new GeoMap({ ...props, center: [0, 0] }))
  const centered = pass.layout(new GeoMap({ ...props, center: [30, 20] }))
  const point = create_geo_projection(prepared, {}, 640, 400)([30, 20])!
  const dx = 320 - point[0], dy = 200 - point[1]
  expect(centered.draw.length).toBe(plain.draw.length)
  for (let i = 0; i < plain.draw.length; i++) {
    const before = plain.draw[i], after = centered.draw[i]
    expect(before.kind).toBe('path')
    expect(after.kind).toBe('path')
    if (before.kind !== 'path' || after.kind !== 'path') continue
    expect(after.bounds!.x - before.bounds!.x).toBeCloseTo(dx, 6)
    expect(after.bounds!.y - before.bounds!.y).toBeCloseTo(dy, 6)
    expect(after.bounds!.width).toBeCloseTo(before.bounds!.width, 6)
    expect(after.bounds!.height).toBeCloseTo(before.bounds!.height, 6)
  }
  expect(centered.size).toEqual(plain.size)
  expect(centered.clip).toEqual(plain.clip)
})

test('rejects nonfinite centers and keeps Albers USA fixed', () => {
  expect(() => create_geo_projection(prepared, { center: [NaN, 20] }, 640, 400)).toThrow('center longitude')
  expect(() => create_geo_projection(prepared, { center: [30, Infinity] }, 640, 400)).toThrow('center latitude')
  expect(() => create_geo_projection(prepare_geo_source(us_states()),
    { projection: 'albersUsa', center: [30, 20] }, 640, 400)).toThrow('albersUsa has fixed center')
})
