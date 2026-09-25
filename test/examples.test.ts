import { expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Evaluator, render_element } from '@gum-jsx/core'
import * as maps from '@gum-jsx/maps'

const examplesDir = join(import.meta.dir, '../docs/examples')
const examples = readdirSync(examplesDir).filter(name => name.endsWith('.jsx')).sort()

for (const name of examples) {
  test(`${name} renders with only the public plugin exports`, async () => {
    const evaluator = new Evaluator({ scope: maps })
    const code = await Bun.file(join(examplesDir, name)).text()
    const result = render_element(evaluator.evaluate(code, { name }))
    expect(result.kind).toBe('svg')
    if (result.kind !== 'svg') return
    expect(result.size.width).toBeGreaterThan(0)
    expect(result.size.height).toBeGreaterThan(0)
    expect(result.svg).toContain('<path ')
    expect(result.svg).not.toMatch(/NaN|Infinity/)
  })
}
