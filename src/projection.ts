import {
  geoAlbersUsa, geoEqualEarth, geoEquirectangular, geoMercator,
  geoNaturalEarth1, geoOrthographic, geoStream,
} from 'd3-geo'
import type { GeoProjection, GeoSphere } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import { prepare_geo_source } from './source'
import type { GeoSource, PreparedSource } from './source'

type ProjectionName = 'equalEarth' | 'naturalEarth1' | 'albersUsa' | 'orthographic' | 'equirectangular' | 'mercator'
type FitTarget = 'sphere' | 'data' | Readonly<{ ids: readonly string[] }>
type GeoView = Readonly<{
  projection?: ProjectionName
  fit_to?: FitTarget
  map_padding?: number // pixels in this helper; GeoMap also accepts Gum lengths
  /** Geographic location to pan to the viewport midpoint after fitting the scale. */
  center?: readonly [longitude: number, latitude: number]
  rotate?: readonly [lambda: number, phi: number, gamma?: number]
  clip_angle?: number | null
  precision?: number
}>

const SPHERE: GeoSphere = { type: 'Sphere' }

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`)
  return value
}

function projection_preset(name: ProjectionName): GeoProjection {
  switch (name) {
    case 'equalEarth': return geoEqualEarth()
    case 'naturalEarth1': return geoNaturalEarth1()
    case 'albersUsa': return geoAlbersUsa()
    case 'orthographic': return geoOrthographic()
    case 'equirectangular': return geoEquirectangular()
    case 'mercator': return geoMercator()
    default: throw new TypeError(`Unknown map projection: ${name}`)
  }
}

function fit_object(source: PreparedSource, target: FitTarget): GeoSphere | FeatureCollection {
  if (target === 'sphere') return SPHERE
  const selected = target === 'data' ? source.features
    : target.ids.map(id => {
      const item = source.by_id.get(id)
      if (!item) throw new Error(`Fit target feature ${JSON.stringify(id)} was not found`)
      return item
    })
  const features = selected.map(item => item.feature)
    .filter((item): item is Feature<Geometry> => item.geometry !== null)
  if (!features.length) throw new Error('The fit target has no geometry')
  return { type: 'FeatureCollection', features }
}

function create_geo_projection(source: PreparedSource, view: GeoView, width: number, height: number): GeoProjection {
  finite(width, 'Map width'); finite(height, 'Map height')
  if (width <= 0 || height <= 0) throw new RangeError('Map width and height must be positive')
  const padding = finite(view.map_padding ?? 8, 'Map padding')
  if (padding < 0 || padding * 2 >= Math.min(width, height)) {
    throw new RangeError('Map padding must leave a positive drawing area')
  }
  const name = view.projection ?? 'naturalEarth1'
  const projection = projection_preset(name)
  if (name === 'albersUsa' && (view.center || view.rotate || view.clip_angle !== undefined)) {
    throw new TypeError('albersUsa has fixed center, rotation, and spherical clipping')
  }
  if (view.center) projection.center([
    finite(view.center[0], 'center longitude'), finite(view.center[1], 'center latitude'),
  ])
  if (view.rotate) projection.rotate([
    finite(view.rotate[0], 'rotate lambda'), finite(view.rotate[1], 'rotate phi'),
    finite(view.rotate[2] ?? 0, 'rotate gamma'),
  ])
  if (view.clip_angle !== undefined) {
    const angle = view.clip_angle
    if (angle !== null && (finite(angle, 'clip_angle') <= 0 || angle > 180)) {
      throw new RangeError('clip_angle must be in (0, 180] degrees or null')
    }
    projection.clipAngle(angle)
  }
  if (view.precision !== undefined) {
    if (finite(view.precision, 'precision') < 0) throw new RangeError('precision must be nonnegative')
    projection.precision(view.precision)
  }
  const target = view.fit_to ?? (name === 'albersUsa' ? 'data' : 'sphere')
  if (name === 'albersUsa' && target === 'sphere') {
    throw new TypeError('albersUsa cannot fit the whole sphere; use data or selected IDs')
  }
  projection.fitExtent([[padding, padding], [width - padding, height - padding]], fit_object(source, target))
  if (view.center) {
    // fitExtent replaces translation, canceling D3's center offset. Pan after
    // fitting so the requested geographic point stays centered, even with rotation.
    const point = projection([view.center[0], view.center[1]])
    if (!point || !point.every(Number.isFinite)) throw new RangeError('Map center must project to a finite point')
    const [x, y] = projection.translate()
    projection.translate([x + width / 2 - point[0], y + height / 2 - point[1]])
  }
  return projection
}

// Stream a point through the projection so clipping (notably the back of an
// orthographic globe) agrees with the geometry path.
function project_geo_point(source: GeoSource | PreparedSource, view: GeoView,
  width: number, height: number, coordinates: readonly [number, number]): readonly [number, number] | null {
  const prepared = 'features' in source ? source : prepare_geo_source(source)
  const projection = create_geo_projection(prepared, view, width, height)
  const point: Point = { type: 'Point', coordinates: [
    finite(coordinates[0], 'longitude'), finite(coordinates[1], 'latitude'),
  ] }
  let result: readonly [number, number] | null = null
  geoStream(point, projection.stream({
    point(x, y) { result = [x, y] },
    lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {},
  }))
  return result
}

export { create_geo_projection, project_geo_point }
export type { ProjectionName, FitTarget, GeoView }
