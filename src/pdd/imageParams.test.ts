import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import { frameFromPixels, frameFromPreset, frameFromRatio } from './frameSpec'
import { buildImageTaskParams, fallbackSizeForRatio, formatPixelSize, requestSizeForFrame } from './imageParams'

describe('image param mapping', () => {
  it('maps preset ratios to legal size strings without claiming 2K or 4K', () => {
    expect(fallbackSizeForRatio('1:1')).toBe('1024x1024')
    expect(fallbackSizeForRatio('3:4')).toBe('768x1024')
    const params = buildImageTaskParams({ ...DEFAULT_PARAMS, n: 4 }, frameFromPreset('9:16'))
    expect(params.n).toBe(1)
    expect(params.size).toBe('720x1280')
    expect(params.aspect_ratio).toBeUndefined()
    expect(params.output_format).toBe('png')
    expect(JSON.stringify(params)).not.toMatch(/2K|4K/i)
  })

  it('maps custom 800×1000 through normalizeImageSize to a 16-multiple request size', () => {
    const parsed = frameFromPixels(800, 1000)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const size = requestSizeForFrame(parsed.frame)
    expect(size).toBe('800x1008')
    const params = buildImageTaskParams(DEFAULT_PARAMS, parsed.frame)
    expect(params.size).toBe('800x1008')
    expect(params.aspect_ratio).toBeUndefined()
  })

  it('maps a custom 4:5 ratio to a mid-size 16-aligned request', () => {
    const parsed = frameFromRatio(4, 5)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const size = requestSizeForFrame(parsed.frame)
    expect(size).toMatch(/^\d+x\d+$/)
    const [w, h] = size.split('x').map(Number)
    expect(w % 16).toBe(0)
    expect(h % 16).toBe(0)
    expect(Math.abs(w / h - 4 / 5)).toBeLessThan(0.03)
  })

  it('formats actual decoded pixels honestly', () => {
    expect(formatPixelSize(1254, 1254)).toBe('1254×1254')
    expect(formatPixelSize(undefined, 1254)).toBeNull()
  })
})
