import { geoPath } from 'd3-geo'
import type { GeoContext, GeoPermissibleObjects, GeoProjection } from 'd3-geo'
import type { PathCommand } from '@gum-jsx/core'

// d3-geo's context API is enough to capture its projected, resampled and
// clipped path without parsing an SVG d string or losing Gum's path validation.
class CommandContext implements GeoContext {
  readonly commands: PathCommand[] = []
  private current: readonly [number, number] | null = null

  beginPath(): void { this.commands.length = 0; this.current = null }
  moveTo(x: number, y: number): void {
    this.commands.push({ kind: 'M', x, y })
    this.current = [x, y]
  }
  lineTo(x: number, y: number): void {
    if (!this.current) this.moveTo(x, y)
    else this.commands.push({ kind: 'L', x, y })
    this.current = [x, y]
  }
  closePath(): void {
    if (this.current) this.commands.push({ kind: 'Z' })
    this.current = null
  }
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number,
    anticlockwise = false): void {
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError('Point radius must be nonnegative')
    if (radius === 0) { this.lineTo(x, y); return }
    const tau = Math.PI * 2
    let sweep = endAngle - startAngle
    if (!anticlockwise && sweep < 0) sweep = ((sweep % tau) + tau) % tau
    if (anticlockwise && sweep > 0) sweep = -(((-sweep % tau) + tau) % tau)
    if (Math.abs(endAngle - startAngle) >= tau) sweep = anticlockwise ? -tau : tau
    const startX = x + radius * Math.cos(startAngle)
    const startY = y + radius * Math.sin(startAngle)
    if (!this.current) this.moveTo(startX, startY)
    else if (Math.hypot(this.current[0] - startX, this.current[1] - startY) > 1e-9) this.lineTo(startX, startY)
    const count = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)))
    const delta = sweep / count
    for (let index = 0; index < count; index++) {
      const a = startAngle + index * delta, b = a + delta
      const k = 4 / 3 * Math.tan(delta / 4) * radius
      const x1 = x + radius * Math.cos(a) - k * Math.sin(a)
      const y1 = y + radius * Math.sin(a) + k * Math.cos(a)
      const x2 = x + radius * Math.cos(b) + k * Math.sin(b)
      const y2 = y + radius * Math.sin(b) - k * Math.cos(b)
      const endX = x + radius * Math.cos(b), endY = y + radius * Math.sin(b)
      this.commands.push({ kind: 'C', x1, y1, x2, y2, x: endX, y: endY })
      this.current = [endX, endY]
    }
  }
}

function projected_commands(projection: GeoProjection, object: GeoPermissibleObjects,
  point_radius = 4.5): readonly PathCommand[] {
  const context = new CommandContext()
  const path = geoPath(projection, context).pointRadius(point_radius)
  path(object)
  return context.commands
}

export { projected_commands }
