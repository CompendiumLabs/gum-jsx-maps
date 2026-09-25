import { expect, test } from 'bun:test'
import { Box, Frame, HStack, LayoutPass, available, em, exact, make_request, px } from '@gum-jsx/core'
import type { ElementProps, Length } from '@gum-jsx/core'
import type { FeatureCollection, LineString } from 'geojson'
import { GeoMap, geojson, us_states, world_countries } from '../src'
import type { GeoBounds } from '../src'

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
const source = geojson(empty)
const sliver = { source, projection: 'equirectangular' as const,
  bounds: [9, 40, 11, 60] as GeoBounds }
const close_size = (size: { width: number; height: number }, width: number, height: number) => {
  expect(size.width).toBeCloseTo(width, 6)
  expect(size.height).toBeCloseTo(height, 6)
}

test('bounds supply a natural aspect for either specified axis and finite offers', () => {
  const pass = new LayoutPass()
  close_size(pass.layout(new GeoMap({ ...sliver, height: px(200) })).size, 20, 200)
  close_size(pass.layout(new GeoMap({ ...sliver, width: px(100) })).size, 100, 1000)
  close_size(pass.layout(new GeoMap(sliver)).size, 40, 400)
  const map = new GeoMap({ ...sliver })
  const request = make_request({ width: available(600), height: available(240) })
  const result = pass.layout(map, request)
  close_size(result.size, 24, 240)
  expect(pass.layout(map, request)).toBe(result)
  close_size(pass.layout(map, make_request({ height: exact(120) })).size, 12, 120)
})

test('natural sizing accounts for pixel, em, and shorter-axis fractional padding', () => {
  const pass = new LayoutPass()
  const paddings: [Length, number][] = [[px(8), 34.4], ['8px', 34.4], [em(0.5), 38],
    [0.1, 200 * 0.1 / 0.82], ['10%', 200 * 0.1 / 0.82]]
  for (const [padding, width] of paddings) {
    close_size(pass.layout(new GeoMap({ ...sliver, height: px(200), padding, font_size: px(20) })).size, width, 200)
  }
  close_size(pass.layout(new GeoMap({ source, projection: 'equirectangular',
    height: px(100), padding: '10%' })).size, 180, 100)
  for (const padding of [px(-1), -0.1, 0.5, '60%'] as const) {
    expect(() => pass.layout(new GeoMap({ ...sliver, padding }))).toThrow('Map padding')
  }
})

test('explicit aspect, exact allocations, and sizing limits override the natural ratio', () => {
  const pass = new LayoutPass()
  const cases: [ElementProps, number, number][] = [
    [{ height: px(200), aspect: 2 }, 400, 200],
    [{ width: px(300), height: px(200) }, 300, 200],
    [{ height: px(200), max_width: px(15) }, 15, 200],
    [{ min_width: px(50), max_width: px(50) }, 50, 500],
    [{ max_height: px(200) }, 20, 200],
  ]
  for (const [props, width, height] of cases) {
    close_size(pass.layout(new GeoMap({ ...sliver, ...props })).size, width, height)
  }
  close_size(pass.layout(new GeoMap({ ...sliver }), make_request({
    width: exact(600), height: exact(240),
  })).size, 600, 240)
})

test('Box, Frame, and stacks hug the measured map without a manually supplied aspect', () => {
  const pass = new LayoutPass()
  const map = new GeoMap({ ...sliver, height: px(200) })
  const box = pass.layout(new Box({ padding: px(10), children: map }))
  close_size(box.size, 40, 220)
  const frame = pass.layout(new Frame({ padding: px(10), border_width: px(2), children: map }))
  close_size(frame.size, 44, 224)
  const constrained = pass.layout(new Frame({ height: px(224), padding: px(10), border_width: px(2),
    children: new GeoMap(sliver) }))
  close_size(constrained.size, 44, 224)
  const stack = pass.layout(new HStack({ gap: px(10), children: [map, map] }))
  close_size(stack.size, 50, 200)
})

test('aspect follows the projection, rotation, curved bounds, and selected data', () => {
  const pass = new LayoutPass()
  close_size(pass.layout(new GeoMap({ source, projection: 'orthographic', height: px(200) })).size, 200, 200)
  close_size(pass.layout(new GeoMap({ source, projection: 'equirectangular', height: px(200) })).size, 400, 200)
  const curved = pass.layout(new GeoMap({ source, height: px(200), padding: 0,
    bounds: [-100, -60, 100, 60] }))
  // Natural Earth's curved sides make the projected ratio differ from degrees.
  expect(curved.size.width / curved.size.height).not.toBeCloseTo(200 / 120, 2)
  const crossing = { source, projection: 'equirectangular' as const, height: px(200), padding: 0,
    bounds: [170, -20, -170, 20] as GeoBounds }
  const joined = pass.layout(new GeoMap({ ...crossing, rotate: [-180, 0] }))
  close_size(joined.size, 100, 200)
  expect(pass.layout(new GeoMap(crossing)).size.width).toBeGreaterThan(joined.size.width * 4)
  const selected = pass.layout(new GeoMap({ source: world_countries(), height: px(200), fit_to: ['276'] }))
  const filtered = pass.layout(new GeoMap({ source: world_countries({ ids: ['276'] }), height: px(200), fit_to: 'data' }))
  expect(selected.size).toEqual(filtered.size)
  expect(selected.size.width).toBeLessThan(200)
  const usa = pass.layout(new GeoMap({ source: us_states(), projection: 'albersUsa', height: px(200) }))
  expect(usa.size.width).toBeGreaterThan(200)
})

test('source resources invalidate intrinsic aspect and one-dimensional data remains fittable', () => {
  const pass = new LayoutPass({ geography: { value: world_countries({ ids: ['276'] }), version: 1 } })
  const map = new GeoMap({ source_resource: 'geography', height: px(200), fit_to: 'data' })
  const first = pass.layout(map)
  pass.set_resource('geography', world_countries({ ids: ['840'] }), 2)
  expect(pass.layout(map).size.width).toBeGreaterThan(first.size.width)
  const line: LineString = { type: 'LineString', coordinates: [[0, -20], [0, 20]] }
  const result = pass.layout(new GeoMap({ source: geojson(line), projection: 'equirectangular', fit_to: 'data' }))
  expect(result.size.width).toBeGreaterThan(0)
  expect(result.size.height).toBeGreaterThan(0)
})
