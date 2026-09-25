import type { Topology } from 'topojson-specification'
import worldData from '../data/world-countries-110m.json'
import statesData from '../data/us-states-10m.json'
import { topojson } from './source'
import type { GeoDataOptions, TopoJSONSource } from './source'

// Preserve the upstream atlas bytes while filling its three missing country IDs
// with stable local values, so every country can receive an ID-keyed style.
const localWorldIds: Record<string, string> = {
  'N. Cyprus': 'local:northern-cyprus',
  Somaliland: 'local:somaliland',
  Kosovo: 'local:kosovo',
}

/** Bundled world-atlas 2.0.2 countries at 1:110m, with a fresh copy on each call. */
function world_countries(options: GeoDataOptions = {}): TopoJSONSource {
  const data = structuredClone(worldData)
  for (const geometry of data.objects.countries.geometries) {
    if (geometry.id != null) continue
    const name = geometry.properties.name
    if (!Object.hasOwn(localWorldIds, name)) throw new Error(`Unrecognized world feature without ID: ${name}`)
    Object.assign(geometry, { id: localWorldIds[name] })
  }
  return topojson(data as unknown as Topology, 'countries', {
    ...options,
    provenance: {
      name: 'Natural Earth countries, world-atlas 2.0.2, 110m',
      version: '2.0.2',
      url: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json',
      viewpoint: 'de facto',
    },
  })
}

/** Bundled us-atlas 3.0.1 states at 1:10m, with a fresh copy on each call. */
function us_states(options: GeoDataOptions = {}): TopoJSONSource {
  return topojson(structuredClone(statesData) as unknown as Topology, 'states', {
    ...options,
    provenance: {
      name: 'US Census state boundaries, us-atlas 3.0.1, 10m',
      version: '3.0.1',
      url: 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json',
      viewpoint: 'US Census',
    },
  })
}

export { world_countries, us_states }
