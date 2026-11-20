import { describe, expect, it } from 'vitest'
import { computeCoverDraw } from './exportSet'

describe('cover crop', () => {
  it('centers a square source into a 4:5 canvas without stretching', () => {
    const draw = computeCoverDraw(1254, 1254, 800, 1000)
    expect(draw.scale).toBeCloseTo(1000 / 1254)
    expect(draw.dh).toBeCloseTo(1000)
    expect(draw.dw).toBeGreaterThan(800)
    expect(draw.dx).toBeLessThan(0)
    expect(draw.dy).toBeCloseTo(0)
  })
})
