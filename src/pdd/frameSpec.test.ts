import { describe, expect, it } from 'vitest'
import { frameFromPixels, frameFromRatio, gcd, parseFrameString, simplifyRatio, validatePixel, validateRatioPart } from './frameSpec'

describe('frameSpec', () => {
  it('computes gcd and simplest ratios including 800×1000 → 4:5', () => {
    expect(gcd(800, 1000)).toBe(200)
    expect(simplifyRatio(800, 1000)).toEqual({ width: 4, height: 5, label: '4:5' })
    expect(simplifyRatio(2, 3).label).toBe('2:3')
  })

  it('validates pixel and ratio inputs', () => {
    expect(validatePixel(800)).toBe(800)
    expect(validatePixel(255)).toBeNull()
    expect(validatePixel(4097)).toBeNull()
    expect(validatePixel(0)).toBeNull()
    expect(validatePixel(-10)).toBeNull()
    expect(validatePixel('abc')).toBeNull()
    expect(validateRatioPart(4)).toBe(4)
    expect(validateRatioPart(0)).toBeNull()
    expect(validateRatioPart(101)).toBeNull()
  })

  it('parses custom pixels and ratios', () => {
    const pixels = frameFromPixels(800, 1000)
    expect(pixels.ok).toBe(true)
    if (pixels.ok) {
      expect(pixels.frame).toEqual({ inputMode: 'pixels', width: 800, height: 1000 })
    }
    const ratio = frameFromRatio(4, 5)
    expect(ratio.ok).toBe(true)
    if (ratio.ok) {
      expect(ratio.frame.inputMode).toBe('ratio')
      expect(ratio.frame.width).toBe(4)
      expect(ratio.frame.height).toBe(5)
    }
    expect(parseFrameString('800x1000').inputMode).toBe('pixels')
    expect(parseFrameString('4:5').inputMode).toBe('ratio')
    expect(parseFrameString('1:1').preset).toBe('1:1')
  })
})
