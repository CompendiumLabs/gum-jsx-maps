import {
  Element, available, draw_path, make_fragment, make_measure, make_rect, make_request, px,
  resolve_length, resolve_paint, resolve_style, shape_size, theme_color,
} from '@gum-jsx/core'
import type { ElementProps, LayoutQuery, Length, Size, StyleSpec } from '@gum-jsx/core'
import { projected_commands } from './path'
import { create_geo_projection } from './projection'
import type { GeoView } from './projection'
import { prepare_geo_source } from './source'
import type { GeoSource, PreparedSource } from './source'

type BorderMode = 'all' | 'interior' | 'none'
type GeoStyle = StyleSpec & Readonly<{ point_radius?: Length }>
type GeoStyleMap = Readonly<Record<string, GeoStyle | undefined>>
type GeoStyles = GeoStyleMap | ((id: string) => GeoStyle | undefined)
type GeoMapProps = ElementProps & Omit<GeoView, 'map_padding'> & Readonly<{
  source?: GeoSource
  /** A GeoSource or PreparedSource installed on the LayoutPass. */
  source_resource?: string
  map_padding?: Length
  /** Fill the projected sphere behind the features, leaving its exterior transparent. */
  background?: string
  styles?: GeoStyles
  border_mode?: BorderMode
  border_color?: string
  border_width?: Length
  point_radius?: Length
  aria_label?: string
}>
type GeoMapData = Omit<GeoMapProps, 'styles'> & Readonly<{ styles?: GeoStyleMap }>

function require_feature_ids(source: PreparedSource): void {
  if (source.features.some(item => !item.explicit_id)) {
    throw new Error('GeoMap styles require IDs on every feature; set id_property on the source')
  }
}

function check_style(style: GeoStyle | undefined, id: string): void {
  if (style !== undefined && (style === null || typeof style !== 'object' || Array.isArray(style))) {
    throw new TypeError(`GeoMap style for ${JSON.stringify(id)} must be a style object`)
  }
}

function map_data({ styles, ...props }: GeoMapProps): GeoMapData {
  if (typeof styles === 'function') {
    if (!props.source || props.source_resource !== undefined) {
      throw new TypeError('GeoMap styles callbacks require source; use an ID-to-style dictionary with source_resource')
    }
    const source = prepare_geo_source(props.source)
    require_feature_ids(source)
    // Consume callbacks at construction, as Bars does; only immutable style data
    // survives into layout. Snapshot each result before calling the callback again.
    return { ...props, styles: Object.fromEntries(source.features.map(({ id }) => {
      const style = styles(id)
      check_style(style, id)
      return [id, structuredClone(style)]
    })) }
  }
  if (styles !== undefined) {
    if (styles === null || typeof styles !== 'object' || Array.isArray(styles)) {
      throw new TypeError('GeoMap styles must be a callback or an ID-to-style dictionary')
    }
    for (const [id, style] of Object.entries(styles)) check_style(style, id)
  }
  return { ...props, styles }
}

function map_size(query: LayoutQuery): Size {
  const { width, height } = query.request
  const request = width.kind === 'natural' && height.kind === 'natural'
    ? make_request({ width: available(720) }) : query.request
  const aspect = query.sizing.aspect ?? (width.kind === 'natural' || height.kind === 'natural' ? 1.8 : undefined)
  return shape_size(request, { ...query.sizing, aspect })
}

function map_source(props: GeoMapData, query: LayoutQuery): PreparedSource {
  if ((props.source === undefined) === (props.source_resource === undefined)) {
    throw new TypeError('GeoMap needs exactly one of source or source_resource')
  }
  return query.prepare('geo-source', () => {
    const input = props.source ?? query.resource<GeoSource | PreparedSource>(props.source_resource!)
    return 'features' in input ? input : prepare_geo_source(input)
  })
}

class GeoMap extends Element<GeoMapData, GeoMapProps> {
  static normalize = map_data
  static defaults = {
    fill: '#dce5e8',
    stroke: 'none',
    border_mode: 'all' as BorderMode,
    border_color: '#ffffff',
    border_width: px(0.7),
    point_radius: px(3),
  }

  static layout(props: GeoMapData, query: LayoutQuery) {
    const size = map_size(query)
    const source = map_source(props, query)
    const shortest = Math.min(size.width, size.height)
    const padding = resolve_length(props.map_padding ?? px(8), query.measure, shortest, 'map_padding')
    const border_width = resolve_length(props.border_width ?? px(0.7), query.measure, shortest, 'border_width')
    const point_radius = resolve_length(props.point_radius ?? px(3), query.measure, shortest, 'point_radius')
    if (border_width < 0 || point_radius < 0) throw new RangeError('Map line and point widths must be nonnegative')
    const projection = create_geo_projection(source, { ...props, map_padding: padding }, size.width, size.height)
    const paint = resolve_paint(query.style, size, query.measure)
    const styles = new Map(Object.entries(props.styles ?? {}))
    if (styles.size) {
      require_feature_ids(source)
      for (const id of styles.keys()) {
        if (!source.by_id.has(id)) throw new Error(`Style feature ${JSON.stringify(id)} was not found`)
      }
    }
    const border_mode = props.border_mode ?? 'all'
    if (!['all', 'interior', 'none'].includes(border_mode)) throw new TypeError('Unknown border_mode')
    if (border_mode === 'interior' && source.kind !== 'topojson') {
      throw new TypeError('Interior borders require TopoJSON shared arcs')
    }
    const border_color = theme_color(props.border_color ?? '#ffffff', query.style.theme)
    const border_paint = { ...paint, fill: 'none', stroke: border_color, stroke_width: border_width }
    const draw = []
    const background = theme_color(props.background ?? 'none', query.style.theme)
    if (background !== 'none') {
      const commands = projected_commands(projection, { type: 'Sphere' })
      if (commands.length) draw.push(draw_path(commands, {
        fill: background, stroke: 'none', stroke_width: 0, opacity: paint.opacity,
      }))
    }
    const features = source.features.flatMap(item => {
      if (item.feature.geometry === null) return []
      const spec = styles.get(item.id)
      const style = spec ? resolve_style(spec, query.style, query.measure) : query.style
      const paint = resolve_paint(style, size, query.measure)
      const radius = spec?.point_radius === undefined ? point_radius
        : resolve_length(spec.point_radius, make_measure(query.measure, { font_size: style.font_size }),
          shortest, 'point_radius')
      if (radius < 0) throw new RangeError('Map point radius must be nonnegative')
      return [{ kind: item.feature.geometry.type, paint,
        commands: projected_commands(projection, item.feature, radius) }]
    })
    for (const { commands, kind, paint } of features) {
      if (commands.length && kind !== 'LineString' && kind !== 'MultiLineString') {
        draw.push(draw_path(commands, {
          ...paint, stroke: 'none', stroke_width: 0,
        }))
      }
    }
    if (border_mode !== 'none' && border_width > 0 && border_color !== 'none') {
      if (source.kind === 'topojson') {
        const geometry = border_mode === 'interior' ? source.interior_borders : source.borders
        if (geometry) {
          const commands = projected_commands(projection, geometry)
          if (commands.length) draw.push(draw_path(commands, border_paint))
        }
      } else {
        // GeoJSON has no shared-arc topology. Strokes are drawn after all fills
        // so later fills cannot cover an earlier feature's boundary.
        for (const { commands } of features) {
          if (commands.length) draw.push(draw_path(commands, border_paint))
        }
      }
    }
    // Shared borders remain a single mesh. Feature strokes overlay that mesh so
    // a highlighted outline is not hidden by adjacent fills or global borders.
    for (const { commands, paint } of features) {
      if (commands.length && paint.stroke !== 'none' && paint.stroke_width > 0) {
        draw.push(draw_path(commands, { ...paint, fill: 'none' }))
      }
    }
    const area = make_rect(0, 0, size.width, size.height)
    return make_fragment({ size, draw, content: area, clip: area,
      ...(props.aria_label ? { label: props.aria_label } : {}) })
  }
}

export { GeoMap }
export type { BorderMode, GeoMapProps, GeoStyle, GeoStyleMap, GeoStyles }
