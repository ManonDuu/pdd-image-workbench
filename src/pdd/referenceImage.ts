import { blobToDataUrl } from '../lib/dataUrl'
import { getImage } from '../lib/db'
import { imageDataUrlToPngBlob } from '../lib/canvasImage'
import type { ProductAsset } from './types'

export type ImageKind = 'png' | 'jpeg' | 'avif' | 'webp' | 'gif' | 'svg' | 'unknown'

export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export type EncodePngFn = (dataUrl: string) => Promise<string>
export type LoadStoredImageFn = (imageId: string) => Promise<{ dataUrl?: string } | undefined>

export class ReferenceImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReferenceImageError'
  }
}

export interface CompatibleReference {
  dataUrl: string
  name: string
  declaredMime: string
  detected: ImageKind
  outputKind: 'png' | 'jpeg'
  converted: boolean
  byteLength: number
}

const SENDABLE: ReadonlySet<ImageKind> = new Set(['png', 'jpeg'])
const CONVERTIBLE: ReadonlySet<ImageKind> = new Set(['avif', 'webp', 'gif', 'svg'])

function bytesStartWith(bytes: Uint8Array, signature: Uint8Array) {
  if (bytes.length < signature.length) return false
  return signature.every((value, index) => bytes[index] === value)
}

function latin1(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end))
}

function readUint32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

/** 看真实字节，不看扩展名或声明 MIME。 */
export function detectImageKind(bytes: Uint8Array): ImageKind {
  if (bytesStartWith(bytes, PNG_SIGNATURE)) return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes.length >= 12 && latin1(bytes, 0, 4) === 'RIFF' && latin1(bytes, 8, 12) === 'WEBP') return 'webp'
  if (bytes.length >= 6) {
    const header = latin1(bytes, 0, 6)
    if (header === 'GIF87a' || header === 'GIF89a') return 'gif'
  }
  const headText = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 256))).trimStart()
  if (headText.startsWith('<svg') || headText.startsWith('<?xml')) return 'svg'
  if (isAvif(bytes)) return 'avif'
  return 'unknown'
}

function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || latin1(bytes, 4, 8) !== 'ftyp') return false
  const boxSize = readUint32(bytes, 0)
  const end = boxSize === 0 ? bytes.length : Math.min(bytes.length, boxSize || bytes.length)
  if (end < 16) return false
  const brands: string[] = [latin1(bytes, 8, 12)]
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(latin1(bytes, offset, offset + 4))
  }
  return brands.some((brand) => brand === 'avif' || brand === 'avis' || brand === 'avia')
}

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const trimmed = dataUrl.trim()
  const match = trimmed.match(/^data:([^;,]+)?((?:;[^,]+)*),([\s\S]*)$/i)
  if (!match) {
    throw new ReferenceImageError('参考图数据不是有效的 Data URL')
  }
  const mime = (match[1] || 'application/octet-stream').trim().toLowerCase()
  const params = match[2] || ''
  const payload = match[3] || ''
  const isBase64 = /;base64/i.test(params)
  const bytes = isBase64 ? base64ToBytes(payload) : new TextEncoder().encode(decodeURIComponent(payload))
  return { mime, bytes }
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '')
  const binary = globalThis.atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return globalThis.btoa(binary)
}

export function bytesToImageDataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`
}

export function mimeForKind(kind: ImageKind): string {
  switch (kind) {
    case 'png':
      return 'image/png'
    case 'jpeg':
      return 'image/jpeg'
    case 'avif':
      return 'image/avif'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

function quoteName(name?: string) {
  const trimmed = (name || '').trim()
  return trimmed ? `「${trimmed}」` : ''
}

export function describeUnsupportedImage(name: string | undefined, detected: ImageKind, reason: 'undecodable' | 'unknown' | 'missing') {
  const label = quoteName(name) || '（未命名）'
  if (reason === 'missing') return `参考图${label}缺少可读取的原图，请重新上传 PNG 或 JPEG`
  if (detected === 'avif' && reason === 'undecodable') {
    return `参考图${label}是 AVIF 格式，当前浏览器无法解码，请转换为 PNG 或 JPEG 后重新上传。`
  }
  if (reason === 'undecodable') {
    return `参考图${label}无法解码或转换，请转换为 PNG 或 JPEG 后重新上传。`
  }
  return `参考图${label}的格式不受支持，请转换为 PNG 或 JPEG 后重新上传。`
}

async function defaultEncodePng(dataUrl: string): Promise<string> {
  const blob = await imageDataUrlToPngBlob(dataUrl)
  const encoded = await blobToDataUrl(blob, 'image/png')
  return encoded
}

function assertPngDataUrl(dataUrl: string, name?: string) {
  const parsed = parseDataUrl(dataUrl)
  if (detectImageKind(parsed.bytes) !== 'png' || !bytesStartWith(parsed.bytes, PNG_SIGNATURE)) {
    throw new ReferenceImageError(describeUnsupportedImage(name, detectImageKind(parsed.bytes), 'undecodable'))
  }
  return bytesToImageDataUrl('image/png', parsed.bytes)
}

export async function ensureCompatibleReferenceDataUrl(
  dataUrl: string,
  options?: { name?: string; encodePng?: EncodePngFn },
): Promise<CompatibleReference> {
  const parsed = parseDataUrl(dataUrl)
  const detected = detectImageKind(parsed.bytes)
  const name = options?.name

  if (SENDABLE.has(detected)) {
    const outputKind = detected as 'png' | 'jpeg'
    const data = bytesToImageDataUrl(mimeForKind(outputKind), parsed.bytes)
    return {
      dataUrl: data,
      name: name || '',
      declaredMime: parsed.mime,
      detected,
      outputKind,
      converted: false,
      byteLength: parsed.bytes.byteLength,
    }
  }

  if (detected === 'unknown') {
    throw new ReferenceImageError(describeUnsupportedImage(name, detected, 'unknown'))
  }

  const encode = options?.encodePng || defaultEncodePng
  try {
    const encoded = assertPngDataUrl(await encode(dataUrl), name)
    const png = parseDataUrl(encoded)
    return {
      dataUrl: encoded,
      name: name || '',
      declaredMime: parsed.mime,
      detected,
      outputKind: 'png',
      converted: true,
      byteLength: png.bytes.byteLength,
    }
  } catch (error) {
    if (error instanceof ReferenceImageError) throw error
    throw new ReferenceImageError(describeUnsupportedImage(name, detected, 'undecodable'))
  }
}

export async function resolveAssetDataUrl(
  asset: Pick<ProductAsset, 'dataUrl' | 'imageId' | 'name' | 'thumbnailDataUrl'>,
  loadStoredImage: LoadStoredImageFn = getImage,
): Promise<string> {
  if (asset.dataUrl) return asset.dataUrl
  const stored = await loadStoredImage(asset.imageId)
  if (stored?.dataUrl) return stored.dataUrl
  throw new ReferenceImageError(describeUnsupportedImage(asset.name, 'unknown', 'missing'))
}

/** 只使用原图，绝不拿缩略图去策划或生图。 */
export async function prepareReferenceAssets(
  assets: ProductAsset[],
  options?: { encodePng?: EncodePngFn; loadStoredImage?: LoadStoredImageFn },
): Promise<CompatibleReference[]> {
  if (!assets.length) {
    throw new ReferenceImageError('请至少上传 1 张商品参考图')
  }
  const prepared: CompatibleReference[] = []
  for (const asset of assets) {
    const raw = await resolveAssetDataUrl(asset, options?.loadStoredImage)
    prepared.push(await ensureCompatibleReferenceDataUrl(raw, { name: asset.name, encodePng: options?.encodePng }))
  }
  return prepared
}

export function isImageFileCandidate(file: Pick<File, 'name' | 'type'>, bytes?: Uint8Array) {
  if (bytes && detectImageKind(bytes) !== 'unknown') return true
  if (file.type && file.type.toLowerCase().startsWith('image/')) return true
  return /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file.name)
}
