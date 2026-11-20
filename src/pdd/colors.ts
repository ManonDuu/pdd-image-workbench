export interface TextPrimaryColor {
  name: string
  hex: string
}

export const TEXT_PRIMARY_PRESETS: TextPrimaryColor[] = [
  { name: '深海蓝', hex: '#1D4ED8' },
  { name: '中国红', hex: '#DC2626' },
  { name: '活力橙', hex: '#EA580C' },
  { name: '明黄', hex: '#EAB308' },
  { name: '翠绿', hex: '#16A34A' },
  { name: '高级紫', hex: '#7C3AED' },
  { name: '酷黑', hex: '#111827' },
  { name: '纯白', hex: '#FFFFFF' },
]

export function normalizeHex(value: string): string | null {
  const raw = value.trim()
  const match = raw.match(/^#?([0-9A-Fa-f]{6})$/)
  if (!match) return null
  return `#${match[1].toUpperCase()}`
}

export function colorFromHex(hex: string): TextPrimaryColor {
  const normalized = normalizeHex(hex) || '#000000'
  const preset = TEXT_PRIMARY_PRESETS.find((item) => item.hex.toUpperCase() === normalized)
  return preset ?? { name: '自定义', hex: normalized }
}

export function describeTextPrimaryColor(color: TextPrimaryColor | null | undefined): string {
  if (!color) return 'AI 自动'
  return `${color.name} (${color.hex})`
}

export function sameColor(a: TextPrimaryColor | null | undefined, b: TextPrimaryColor | null | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return normalizeHex(a.hex) === normalizeHex(b.hex)
}
