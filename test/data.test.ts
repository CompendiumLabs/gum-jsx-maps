import { describe, expect, test } from 'bun:test'
import { prepare_geo_source, us_states, world_countries } from '@gum-jsx/maps'

describe('bundled geography', () => {
  test('world countries have explicit, stable IDs for fill joins', () => {
    const source = world_countries()
    const prepared = prepare_geo_source(source)
    expect(prepared.features).toHaveLength(177)
    expect(prepared.features.every(item => item.explicit_id)).toBe(true)
    expect(prepared.by_id.get('076')?.feature.properties?.name).toBe('Brazil')
    expect(prepared.by_id.get('840')?.feature.properties?.name).toBe('United States of America')
    expect(prepared.by_id.get('local:northern-cyprus')?.feature.properties?.name).toBe('N. Cyprus')
    expect(prepared.by_id.get('local:somaliland')?.feature.properties?.name).toBe('Somaliland')
    expect(prepared.by_id.get('local:kosovo')?.feature.properties?.name).toBe('Kosovo')
    expect(source.provenance?.version).toBe('2.0.2')
    expect(source.provenance?.url).toBe('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
  })

  test('US states retain padded FIPS IDs and shared interior borders', () => {
    const source = us_states()
    const prepared = prepare_geo_source(source)
    expect(prepared.features).toHaveLength(56)
    expect(prepared.features.every(item => item.explicit_id)).toBe(true)
    expect(prepared.by_id.get('06')?.feature.properties?.name).toBe('California')
    expect(prepared.by_id.get('11')?.feature.properties?.name).toBe('District of Columbia')
    expect(prepared.by_id.get('72')?.feature.properties?.name).toBe('Puerto Rico')
    expect(prepared.interior_borders?.type).toBe('MultiLineString')
    expect(source.provenance?.version).toBe('3.0.1')
    expect(source.provenance?.url).toBe('https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json')
  })

  for (const accessor of [world_countries, us_states]) {
    test(`${accessor.name} isolates edits from later calls`, () => {
      const original = accessor()
      const edited = accessor()
      edited.data.arcs[0][0][0] += 1
      edited.data.objects = {}
      expect(accessor()).toEqual(original)
    })
  }
})
