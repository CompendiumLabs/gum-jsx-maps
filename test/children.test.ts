import { expect, test } from 'bun:test'
import { Arrow, CoordLine, LayoutPass, Line, Points, Polyline, Rect, exact, make_request, px } from '@gum-jsx/core'
import { GeoMap, geojson, prepare_geo_source, project_geo_point } from '../src'
import type { GeoView } from '../src'
import type { Point } from 'geojson'

const geometry: Point = { type: 'Point', coordinates: [30, 20] }
const source = geojson(geometry)
const prepared = prepare_geo_source(source)
const point = [30, 20] as const

test('map children share the fitted projection through resizing, centering, and rotation', () => {
  const marker = new Points({ points: [point], point_size: px(8), fill: 'red' })
  const annotation = new Rect({ x: point[0], y: point[1], width: px(10), height: px(6), anchor: 'center' })
  const pass = new LayoutPass()
  for (const view of [
    {}, { center: point }, { projection: 'orthographic', rotate: [-30, -20, 0] },
    { projection: 'equirectangular', map_padding: 25 },
  ] satisfies GeoView[]) {
    const map = new GeoMap({ source, ...view,
      map_padding: px(view.map_padding ?? 8), children: [marker, annotation] })
    for (const [width, height] of [[640, 400], [320, 500]]) {
      const fragment = pass.layout(map, make_request({ width: exact(width), height: exact(height) }))
      const projected = project_geo_point(prepared, view, width, height, point)!
      const dot = fragment.children[0].fragment.children[0]
      expect(dot.offset.x + 4).toBeCloseTo(projected[0], 8)
      expect(dot.offset.y + 4).toBeCloseTo(projected[1], 8)
      expect(dot.fragment.size).toEqual({ width: 8, height: 8 })
      const label = fragment.children[1]
      expect(label.offset.x + 5).toBeCloseTo(projected[0], 8)
      expect(label.offset.y + 3).toBeCloseTo(projected[1], 8)
      expect(fragment.clip).toEqual({ x: 0, y: 0, width, height })
    }
  }
})

test('globe visibility hides back-side annotations and breaks ordinary paths', () => {
  const points = [[0, 0], [20, 10], [180, 0], [-20, -10], [-10, 0]] as const
  const pass = new LayoutPass()
  const result = pass.layout(new GeoMap({ source, projection: 'orthographic', width: px(400), height: px(400),
    children: [new Points({ points }), new CoordLine({ points }),
      new Arrow({ points, stroke: 'red', start_head: true }),
      new Rect({ x: 180, y: 0, width: px(10), height: px(10) })] }))
  expect(result.children[0].fragment.children.length).toBe(4)
  const line = result.children[1].fragment.draw[0]
  expect(line.kind === 'path' && line.commands.map(c => c.kind)).toEqual(['M', 'L', 'M', 'L'])
  expect(result.children[2].fragment.draw.length).toBe(4)
  expect(result.children[3].fragment.draw).toEqual([])
})

test('local children bypass geography and source-resource maps support annotations', () => {
  const pass = new LayoutPass({ geography: { value: prepared, version: 1 } })
  const map = new GeoMap({ source_resource: 'geography', width: px(400), height: px(300), children: [
    new Points({ points: [point], point_size: px(8) }),
    new Rect({ x: px(12), y: px(24), width: px(10), height: px(10) }),
    new CoordLine({ space: 'local', points: [[0, 0], [1, 1]] }),
  ] })
  const result = pass.layout(map)
  expect(result.children[1].offset).toEqual({ x: 12, y: 24 })
  const line = result.children[2].fragment.draw[0]
  expect(line.kind === 'path' && line.commands).toEqual([
    { kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 400, y: 300 },
  ])
  const projected = project_geo_point(prepared, {}, 400, 300, point)!
  expect(result.children[0].fragment.children[0].offset.x + 4).toBeCloseTo(projected[0], 8)
})

test('Line and Polyline opt into the same map projection and visibility as marks', () => {
  const points = [[0, 0], [20, 10], [180, 0], [-20, -10], [-10, 0]] as const
  const result = new LayoutPass().layout(new GeoMap({ source, projection: 'orthographic',
    width: px(400), height: px(400), children: [
      new CoordLine({ points }), new Polyline({ points, space: 'data' }),
      new Line({ from: points[0], to: points[1], space: 'data' }),
      new Line({ from: points[0], to: points[2], space: 'data' }),
    ] }))
  const draws = result.children.map(child => child.fragment.draw[0])
  expect(draws[1]).toEqual(draws[0])
  const expected = points.slice(0, 2).map((point, index) => {
    const [x, y] = project_geo_point(prepared, { projection: 'orthographic' }, 400, 400, point)!
    return { kind: index ? 'L' : 'M', x, y } as const
  })
  expect(draws[2].kind === 'path' && draws[2].commands).toEqual(expected)
  expect(draws[3].kind === 'path' && draws[3].commands).toEqual([])
})
