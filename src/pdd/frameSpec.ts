import { ASPECT_RATIOS, type AspectRatio, type FrameSpec } from './types'

export const MIN_PIXEL = 256
export const MAX_PIXEL = 4096
export const MIN_RATIO = 1
export const MAX_RATIO = 100

export const DEFAULT_FRAME: FrameSpec = {
  inputMode: 'preset',
  preset: '1:1',
  width: 1,
  height: 1,
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  if (x === 0 && y === 0) return 1
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

export function simplifyRatio(width: number, height: number): { width: number; height: number; label: string } {
  const w = Math.abs(Math.round(width))
  const h = Math.abs(Math.round(height))
  const divisor = gcd(w, h)
  const sw = Math.max(1, w / divisor)
  const sh = Math.max(1, h / divisor)
  return { width: sw, height: sh, label: `${sw}:${sh}` }
}

export function isPresetRatio(value: string): value is AspectRatio {
  return (ASPECT_RATIOS as readonly string[]).includes(value)
}

export function frameFromPreset(ratio: AspectRatio): FrameSpec {
  const [width, height] = ratio.split(':').map(Number)
  return { inputMode: 'preset', preset: ratio, width, height }
}

export function validatePixel(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  const rounded = Math.round(n)
  if (rounded < MIN_PIXEL || rounded > MAX_PIXEL) return null
  return rounded
}

export function validateRatioPart(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  const rounded = Math.round(n)
  if (rounded < MIN_RATIO || rounded > MAX_RATIO) return null
  return rounded
}

export function frameFromPixels(width: unknown, height: unknown): { ok: true; frame: FrameSpec } | { ok: false; error: string } {
  const w = validatePixel(width)
  const h = validatePixel(height)
  if (w == null || h == null) {
    return { ok: false, error: `像素宽高须为 ${MIN_PIXEL}–${MAX_PIXEL} 的正整数` }
  }
  return { ok: true, frame: { inputMode: 'pixels', width: w, height: h } }
}

export function frameFromRatio(width: unknown, height: unknown): { ok: true; frame: FrameSpec } | { ok: false; error: string } {
  const w = validateRatioPart(width)
  const h = validateRatioPart(height)
  if (w == null || h == null) {
    return { ok: false, error: `比例须为 ${MIN_RATIO}–${MAX_RATIO} 的正整数` }
  }
  const simplified = simplifyRatio(w, h)
  if (isPresetRatio(simplified.label)) return { ok: true, frame: frameFromPreset(simplified.label) }
  return { ok: true, frame: { inputMode: 'ratio', width: simplified.width, height: simplified.height } }
}

/** 解析策划返回或用户输入的比例/尺寸字符串。 */
export function parseFrameString(raw: string, fallback: FrameSpec = DEFAULT_FRAME): FrameSpec {
  const text = raw.trim().replace(/[×X]/g, 'x').replace(/\s+/g, '')
  if (!text) return fallback
  if (isPresetRatio(text)) return frameFromPreset(text)
  const pixel = text.match(/^(\d+)x(\d+)(?:px)?$/i)
  if (pixel) {
    const parsed = frameFromPixels(pixel[1], pixel[2])
    return parsed.ok ? parsed.frame : fallback
  }
  const ratio = text.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (ratio) {
    const parsed = frameFromRatio(ratio[1], ratio[2])
    return parsed.ok ? parsed.frame : fallback
  }
  return fallback
}

export function describeFrame(spec: FrameSpec): string {
  if (spec.inputMode === 'preset') return spec.preset || '1:1'
  if (spec.inputMode === 'pixels') {
    const ratio = simplifyRatio(spec.width, spec.height)
    return `${spec.width}×${spec.height}px（≈ ${ratio.label}）`
  }
  const ratio = simplifyRatio(spec.width, spec.height)
  return ratio.label
}

export function frameRatioLabel(spec: FrameSpec): string {
  if (spec.inputMode === 'preset') return spec.preset || '1:1'
  return simplifyRatio(spec.width, spec.height).label
}

export function customPixelTarget(spec?: FrameSpec | null): { width: number; height: number } | null {
  if (spec?.inputMode === 'pixels') return { width: spec.width, height: spec.height }
  return null
}

export function framesEqual(a: FrameSpec, b: FrameSpec): boolean {
  return a.inputMode === b.inputMode && a.preset === b.preset && a.width === b.width && a.height === b.height
}

export function normalizeStoredFrame(value: unknown, fallback: FrameSpec = DEFAULT_FRAME): FrameSpec {
  if (!value || typeof value !== 'object') return fallback
  const rec = value as Partial<FrameSpec>
  if (rec.inputMode === 'preset' && rec.preset && isPresetRatio(rec.preset)) return frameFromPreset(rec.preset)
  if (rec.inputMode === 'pixels') {
    const parsed = frameFromPixels(rec.width, rec.height)
    return parsed.ok ? parsed.frame : fallback
  }
  if (rec.inputMode === 'ratio') {
    const parsed = frameFromRatio(rec.width, rec.height)
    return parsed.ok ? parsed.frame : fallback
  }
  return fallback
}
