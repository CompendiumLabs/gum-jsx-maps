/// <reference path="./types/d3-geo-projection.d.ts" />
import { geoStitch } from 'd3-geo-projection'
import { feature, mesh } from 'topojson-client'
import type { Feature, FeatureCollection, GeoJsonObject, Geometry, GeometryCollection, MultiPolygon, Polygon } from 'geojson'
import type { Topology } from 'topojson-specification'

type Winding = 'rfc7946' | 'd3'
type Provenance = Readonly<{
  name: string
  version?: string
  url?: string
  viewpoint?: string
}>
type GeoJSONSource = Readonly<{
  kind: 'geojson'
  data: GeoJsonObject
  winding?: Winding
  id_property?: string
  provenance?: Provenance
}>
type TopoJSONSource = Readonly<{
  kind: 'topojson'
  data: Topology
  object: string
  id_property?: string
  provenance?: Provenance
}>
type GeoSource = GeoJSONSource | TopoJSONSource
type GeoFeature = Feature<Geometry | null>
type NamedFeature = Readonly<{ id: string; feature: GeoFeature; explicit_id: boolean }>
type PreparedSource = Readonly<{
  features: readonly NamedFeature[]
  by_id: ReadonlyMap<string, NamedFeature>
  borders?: Geometry
  interior_borders?: Geometry
  kind: GeoSource['kind']
}>

function geojson(data: GeoJsonObject, options: Omit<GeoJSONSource, 'kind' | 'data'> = {}): GeoJSONSource {
  return { kind: 'geojson', data, ...options }
}

function topojson(data: Topology, object: string,
  options: Omit<TopoJSONSource, 'kind' | 'data' | 'object'> = {}): TopoJSONSource {
  if (!object) throw new TypeError('A TopoJSON object name is required')
  return { kind: 'topojson', data, object, ...options }
}

function reverse_geometry(geometry: Geometry): Geometry {
  switch (geometry.type) {
    case 'Polygon': return { ...geometry,
      coordinates: geometry.coordinates.map(ring => [...ring].reverse()) } satisfies Polygon
    case 'MultiPolygon': return { ...geometry,
      coordinates: geometry.coordinates.map(polygon => polygon.map(ring => [...ring].reverse())) } satisfies MultiPolygon
    case 'GeometryCollection': return { ...geometry,
      geometries: geometry.geometries.map(reverse_geometry) } satisfies GeometryCollection
    default: return geometry
  }
}

// RFC 7946 and D3 use opposite spherical ring conventions. Stitch RFC cuts
// first, then reverse every exterior and interior ring without mutating input.
function normalize_rfc(object: GeoJsonObject): GeoJsonObject {
  const stitched = geoStitch(object)
  if (stitched.type === 'FeatureCollection') {
    const collection = stitched as FeatureCollection<Geometry | null>
    const result: FeatureCollection<Geometry | null> = { ...collection,
      features: collection.features.map(item => ({ ...item,
      geometry: item.geometry ? reverse_geometry(item.geometry) : null })),
    }
    return result
  }
  if (stitched.type === 'Feature') {
    const item = stitched as GeoFeature
    const result: GeoFeature = { ...item, geometry: item.geometry ? reverse_geometry(item.geometry) : null }
    return result
  }
  return reverse_geometry(stitched as Geometry)
}

function as_features(object: GeoJsonObject): GeoFeature[] {
  if (object.type === 'FeatureCollection') return (object as FeatureCollection<Geometry | null>).features
  if (object.type === 'Feature') return [object as GeoFeature]
  return [{ type: 'Feature', properties: {}, geometry: object as Geometry }]
}

function identify(item: GeoFeature, index: number, id_property?: string): NamedFeature {
  const value = id_property && item.properties && Object.hasOwn(item.properties, id_property)
    ? item.properties[id_property] : id_property ? undefined : item.id
  if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') {
    throw new TypeError(`Feature ${index} has a non-string/non-number ID`)
  }
  const explicit_id = value !== undefined && value !== null
  return { id: String(explicit_id ? value : index), feature: item, explicit_id }
}

function prepare_geo_source(source: GeoSource): PreparedSource {
  let items: GeoFeature[]
  let borders: Geometry | undefined
  let interior_borders: Geometry | undefined
  if (source.kind === 'geojson') {
    if (source.winding && !['rfc7946', 'd3'].includes(source.winding)) {
      throw new TypeError(`Unknown winding convention: ${source.winding}`)
    }
    const data = (source.winding ?? 'rfc7946') === 'rfc7946'
      ? normalize_rfc(source.data) : source.data
    items = as_features(data)
  } else if (source.kind === 'topojson') {
    const object = Object.hasOwn(source.data.objects, source.object)
      ? source.data.objects[source.object] : undefined
    if (!object) throw new Error(`TopoJSON object ${JSON.stringify(source.object)} was not found`)
    items = as_features(feature(source.data, object))
    const mesh_object = object as Parameters<typeof mesh>[1]
    borders = mesh(source.data, mesh_object)
    interior_borders = mesh(source.data, mesh_object, (a, b) => a !== b)
  } else {
    throw new TypeError('Expected a GeoJSON or TopoJSON source')
  }
  const features = items.map((item, index) => identify(item, index, source.id_property))
  const by_id = new Map<string, NamedFeature>()
  for (const named of features) {
    if (by_id.has(named.id)) throw new Error(`Duplicate feature ID ${JSON.stringify(named.id)}`)
    by_id.set(named.id, named)
  }
  return { kind: source.kind, features, by_id, borders, interior_borders }
}

export { geojson, topojson, prepare_geo_source }
export type { Winding, Provenance, GeoJSONSource, TopoJSONSource, GeoSource, NamedFeature, PreparedSource }
