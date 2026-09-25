declare module 'd3-geo-projection' {
  import type { GeoJsonObject } from 'geojson'

  /** Rejoin RFC 7946 antimeridian and polar cuts before spherical projection. */
  export function geoStitch<T extends GeoJsonObject>(object: T): T
}
