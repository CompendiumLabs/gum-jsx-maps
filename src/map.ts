import {
  Element, available, draw_path, make_fragment, make_rect, make_request, px,
  resolve_length, resolve_paint, shape_size, theme_color,
} from '@gum-jsx/core'
import type { ElementProps, LayoutQuery, Length, Size } from '@gum-jsx/core'
import { projected_commands } from './path'
import { create_geo_projection } from './projection'
import type { GeoView } from './projection'
import { prepare_geo_source } from './source'
import type { GeoSource, PreparedSource } from './source'

type BorderMode = 'all' | 'interior' | 'none'
type GeoMapProps = ElementProps & Omit<GeoView, 'map_padding'> & Readonly<{
  source?: GeoSource
  /** A GeoSource or PreparedSource installed on the LayoutPass. */
  source_resource?: string
  map_padding?: Length
  fill_by_id?: Readonly<Record<string, string>>
  border_mode?: BorderMode
  border_color?: string
  border_width?: Length
  point_radius?: Length
  aria_label?: string
}>

function map_size(query: LayoutQuery): Size {
  const { width, height } = query.request
  const request = width.kind === 'natural' && height.kind === 'natural'
    ? make_request({ width: available(720) }) : query.request
  const aspect = query.sizing.aspect ?? (width.kind === 'natural' || height.kind === 'natural' ? 1.8 : undefined)
  return shape_size(request, { ...query.sizing, aspect })
}

function map_source(props: GeoMapProps, query: LayoutQuery): PreparedSource {
  if ((props.source === undefined) === (props.source_resource === undefined)) {
    throw new TypeError('GeoMap needs exactly one of source or source_resource')
  }
  return query.prepare('geo-source', () => {
    const input = props.source ?? query.resource<GeoSource | PreparedSource>(props.source_resource!)
    return 'features' in input ? input : prepare_geo_source(input)
  })
}

class GeoMap extends Element<GeoMapProps> {
  static defaults = {
    fill: '#dce5e8',
    stroke: 'none',
    border_mode: 'all' as BorderMode,
    border_color: '#ffffff',
    border_width: px(0.7),
    point_radius: px(3),
  }

  static layout(props: GeoMapProps, query: LayoutQuery) {
    const size = map_size(query)
    const source = map_source(props, query)
    const shortest = Math.min(size.width, size.height)
    const padding = resolve_length(props.map_padding ?? px(8), query.measure, shortest, 'map_padding')
    const border_width = resolve_length(props.border_width ?? px(0.7), query.measure, shortest, 'border_width')
    const point_radius = resolve_length(props.point_radius ?? px(3), query.measure, shortest, 'point_radius')
    if (border_width < 0 || point_radius < 0) throw new RangeError('Map line and point widths must be nonnegative')
    const projection = create_geo_projection(source, { ...props, map_padding: padding }, size.width, size.height)
    const paint = resolve_paint(query.style, size, query.measure)
    const fills = new Map(Object.entries(props.fill_by_id ?? {}))
    if (fills.size) {
      if (source.features.some(item => !item.explicit_id)) {
        throw new Error('fill_by_id requires IDs on every feature; set id_property on the source')
      }
      for (const [id, color] of fills) {
        if (!source.by_id.has(id)) throw new Error(`Fill feature ${JSON.stringify(id)} was not found`)
        if (typeof color !== 'string') throw new TypeError(`Fill for ${JSON.stringify(id)} must be a color string`)
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
    for (const item of source.features) {
      if (item.feature.geometry === null) continue
      const commands = projected_commands(projection, item.feature, point_radius)
      const kind = item.feature.geometry.type
      if (commands.length && kind !== 'LineString' && kind !== 'MultiLineString') {
        draw.push(draw_path(commands, {
          ...paint, fill: theme_color(fills.get(item.id) ?? paint.fill, query.style.theme),
          stroke: 'none', stroke_width: 0,
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
        for (const item of source.features) {
          if (item.feature.geometry === null) continue
          const commands = projected_commands(projection, item.feature, point_radius)
          if (commands.length) draw.push(draw_path(commands, border_paint))
        }
      }
    }
    const area = make_rect(0, 0, size.width, size.height)
    return make_fragment({ size, draw, content: area, clip: area,
      ...(props.aria_label ? { label: props.aria_label } : {}) })
  }
}

export { GeoMap }
export type { BorderMode, GeoMapProps }
