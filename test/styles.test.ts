import { expect, test } from 'bun:test'
import { LayoutPass, THEMES, em, exact, make_request, px } from '@gum-jsx/core'
import type { FeatureCollection, Point } from 'geojson'
import { GeoMap, geojson, prepare_geo_source } from '../src'
import type { GeoStyle, GeoStyleMap } from '../src'

const data: FeatureCollection = { type: 'FeatureCollection', features: [
  { type: 'Feature', id: '001', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
  { type: 'Feature', id: '002', properties: {}, geometry: { type: 'Point', coordinates: [10, 10] } },
  { type: 'Feature', id: '003', properties: {}, geometry: { type: 'Point', coordinates: [20, 0] } },
] }
const source = geojson(data)

test('callbacks and dictionaries resolve the same feature paints, lengths, and inherited defaults', () => {
  const styles: GeoStyleMap = {
    '001': { fill: 'red', opacity: 0.4, point_radius: em(0.25),
      stroke: 'black', stroke_width: em(0.1), stroke_dasharray: [px(2), px(1)] },
    '003': { fill: 'theme:area' },
  }
  const props = { source, width: px(400), height: px(240), font_size: px(20),
    theme: 'dark' as const, fill: 'blue', opacity: 0.8, border_mode: 'none' as const }
  const pass = new LayoutPass()
  const dictionary = pass.layout(new GeoMap({ ...props, styles }))
  const callback = pass.layout(new GeoMap({ ...props, styles: id => styles[id] }))
  expect(callback.draw).toEqual(dictionary.draw)
  expect(dictionary.draw).toHaveLength(4)
  expect(dictionary.draw.map(item => item.fill)).toEqual(['red', 'blue', THEMES.dark.area, 'none'])
  expect(dictionary.draw.map(item => item.opacity)).toEqual([0.4, 0.8, 0.8, 0.4])
  expect(dictionary.draw[3]).toMatchObject({ stroke: 'black', stroke_width: 2, stroke_dasharray: [2, 1] })
  const first = dictionary.draw[0], second = dictionary.draw[1]
  if (first.kind !== 'path' || second.kind !== 'path') throw new Error('Expected point paths')
  expect(first.bounds!.width).toBeCloseTo(10, 6)
  expect(second.bounds!.width).toBeCloseTo(6, 6)
})

test('snapshots each callback result once and does not rerun callbacks on resizing or new passes', () => {
  const calls: string[] = []
  const reused: GeoStyle & { fill: string } = { fill: 'blue' }
  const map = new GeoMap({ source, border_mode: 'none', styles: id => {
    calls.push(id)
    reused.fill = id === '001' ? 'red' : 'green'
    return reused
  } })
  expect(calls).toEqual(['001', '002', '003'])
  reused.fill = 'purple'
  expect(Object.isFrozen(map.props.styles!['001'])).toBe(true)
  const pass = new LayoutPass()
  for (const width of [320, 640]) {
    const result = pass.layout(map, make_request({ width: exact(width) }))
    expect(result.draw.map(item => item.fill)).toEqual(['red', 'green', 'green'])
  }
  new LayoutPass().layout(map)
  expect(calls).toEqual(['001', '002', '003'])
})

test('snapshots dictionaries and resolves styles against shared pass resources', () => {
  const styles = { '002': { fill: 'red', point_radius: px(5) } }
  const map = new GeoMap({ source_resource: 'geography', styles })
  styles['002'].fill = 'purple'
  const pass = new LayoutPass({ geography: { value: prepare_geo_source(source), version: 1 } })
  expect(pass.layout(map).draw[1].fill).toBe('red')
  pass.set_resource('geography', geojson({ type: 'FeatureCollection', features: [data.features[0]] } as FeatureCollection), 2)
  expect(() => pass.layout(map)).toThrow('Style feature "002" was not found')
  expect(() => new GeoMap({ source_resource: 'geography', styles: () => ({ fill: 'red' }) }))
    .toThrow('styles callbacks require source')
})

test('uses explicit string IDs and id_property for styles', () => {
  const calls: string[] = []
  const own = geojson({ type: 'FeatureCollection', features: data.features.map((feature, i) => ({
    ...feature, properties: { code: i === 0 ? '007' : i },
  })) } as FeatureCollection, { id_property: 'code' })
  new GeoMap({ source: own, styles: id => { calls.push(id); return undefined } })
  expect(calls).toEqual(['007', '1', '2'])
  const unnamed = geojson({ type: 'Point', coordinates: [0, 0] } as Point)
  expect(() => new GeoMap({ source: unnamed, styles: () => ({ fill: 'red' }) })).toThrow('require IDs')
  expect(() => new LayoutPass().layout(new GeoMap({ source: unnamed, styles: { '0': { fill: 'red' } } })))
    .toThrow('require IDs')
  expect(() => new LayoutPass().layout(new GeoMap({ source, styles: { missing: { fill: 'red' } } })))
    .toThrow('Style feature "missing" was not found')
})

test('undefined styles inherit and invalid styles fail clearly', () => {
  const pass = new LayoutPass()
  const plain = pass.layout(new GeoMap({ source }))
  expect(pass.layout(new GeoMap({ source, styles: () => undefined })).draw).toEqual(plain.draw)
  expect(pass.layout(new GeoMap({ source, styles: { '001': { fill: undefined } } })).draw).toEqual(plain.draw)
  expect(() => new GeoMap({ source, styles: [] as never })).toThrow('ID-to-style dictionary')
  expect(() => new GeoMap({ source, styles: { '001': 'red' } as never })).toThrow('must be a style object')
  expect(() => new GeoMap({ source, styles: () => 'red' as never })).toThrow('must be a style object')
  expect(() => pass.layout(new GeoMap({ source, styles: { '001': { opacity: 2 } } })))
    .toThrow('opacity must be between 0 and 1')
  expect(() => pass.layout(new GeoMap({ source, styles: { '001': { point_radius: px(-1) } } })))
    .toThrow('point radius must be nonnegative')
})
