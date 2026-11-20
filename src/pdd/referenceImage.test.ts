import { describe, expect, it } from 'vitest'
import {
  bytesToImageDataUrl,
  detectImageKind,
  ensureCompatibleReferenceDataUrl,
  parseDataUrl,
  prepareReferenceAssets,
  PNG_SIGNATURE,
  ReferenceImageError,
} from './referenceImage'
import type { ProductAsset } from './types'

// 真实微小栅格图（16×16 RGB 编码），按字节识别，不看扩展名。
const pngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAALklEQVR4nGO8o6bmqLGJgWjAKOt3g3jVDAwMTCSpZhjVQBxgIlIdHIxqYCACAACzgQOlE/HZRwAAAABJRU5ErkJggg==').split('').map((c) => c.charCodeAt(0)))
const jpegBytes = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD59JLEknJPUmkoor+zElFWWx+QNuTbbu2f/9k=').split('').map((c) => c.charCodeAt(0)))
const avifBytes = Uint8Array.from(atob('AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAKwAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAEAAAABAAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAM21kYXQSAAoJGAz/2iAhoNCAMhxFMeHhmUCCCCeUAAAAOtxF0s99ZXknVWriBG6A').split('').map((c) => c.charCodeAt(0)))
const webpBytes = Uint8Array.from(atob('UklGRkwAAABXRUJQVlA4IEAAAADwAQCdASoQABAAAMASJbACdLoB+AAETAAA/vmprOsEG/+ylPt0vvV/9nl/Z5f/Z5f/18a/Xq5C+end+nd/e+AA').split('').map((c) => c.charCodeAt(0)))
const truncatedAvif = Uint8Array.from(atob('AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYx').split('').map((c) => c.charCodeAt(0)))

const pngDataUrl = bytesToImageDataUrl('image/png', pngBytes)
const jpegDataUrl = bytesToImageDataUrl('image/jpeg', jpegBytes)
const avifDataUrl = bytesToImageDataUrl('image/avif', avifBytes)
const webpDataUrl = bytesToImageDataUrl('image/webp', webpBytes)

function asset(partial: Partial<ProductAsset> & Pick<ProductAsset, 'id' | 'imageId' | 'name'>): ProductAsset {
  return { width: 16, height: 16, ...partial }
}

function encodeToPng() {
  return async () => pngDataUrl
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  expect(Array.from(left)).toEqual(Array.from(right))
}

describe('detectImageKind', () => {
  it('recognizes real PNG, JPEG, AVIF and WebP by magic bytes, not names', () => {
    expect(detectImageKind(pngBytes)).toBe('png')
    expect(detectImageKind(jpegBytes)).toBe('jpeg')
    expect(detectImageKind(avifBytes)).toBe('avif')
    expect(detectImageKind(webpBytes)).toBe('webp')
    expect(detectImageKind(truncatedAvif)).toBe('avif')
  })
})

describe('ensureCompatibleReferenceDataUrl', () => {
  it('keeps real PNG and JPEG bytes and corrects a lying MIME', async () => {
    const png = await ensureCompatibleReferenceDataUrl(bytesToImageDataUrl('image/avif', pngBytes), { name: 'looks-avif.png' })
    expect(png.converted).toBe(false)
    expect(png.outputKind).toBe('png')
    expect(png.detected).toBe('png')
    expect(png.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    sameBytes(parseDataUrl(png.dataUrl).bytes, pngBytes)

    const jpeg = await ensureCompatibleReferenceDataUrl(bytesToImageDataUrl('image/png', jpegBytes), { name: 'looks-png.jpg' })
    expect(jpeg.converted).toBe(false)
    expect(jpeg.outputKind).toBe('jpeg')
    sameBytes(parseDataUrl(jpeg.dataUrl).bytes, jpegBytes)
  })

  it('converts a real AVIF data URL to a PNG with a verified signature', async () => {
    const result = await ensureCompatibleReferenceDataUrl(avifDataUrl, { name: 'engineering-set-source.avif', encodePng: encodeToPng() })
    expect(result.converted).toBe(true)
    expect(result.detected).toBe('avif')
    expect(result.outputKind).toBe('png')
    const bytes = parseDataUrl(result.dataUrl).bytes
    expect(Array.from(bytes.subarray(0, 8))).toEqual(Array.from(PNG_SIGNATURE))
  })

  it('converts WebP the same way and never only rewrites the MIME', async () => {
    const result = await ensureCompatibleReferenceDataUrl(webpDataUrl, { name: 'photo.webp', encodePng: encodeToPng() })
    expect(result.converted).toBe(true)
    expect(result.detected).toBe('webp')
    expect(detectImageKind(parseDataUrl(result.dataUrl).bytes)).toBe('png')
    expect(result.dataUrl).not.toBe(webpDataUrl)
  })

  it('fails clearly when conversion cannot produce a PNG, and does not invent a fake MIME', async () => {
    await expect(ensureCompatibleReferenceDataUrl(bytesToImageDataUrl('image/avif', truncatedAvif), {
      name: 'broken.avif',
      encodePng: async () => {
        throw new Error('browser cannot decode')
      },
    })).rejects.toSatisfy((error: unknown) => (
      error instanceof ReferenceImageError
      && error.message.includes('broken.avif')
      && error.message.includes('AVIF')
      && error.message.includes('无法解码')
    ))
  })
})

describe('prepareReferenceAssets', () => {
  it('uses the original image from an old session even if the thumbnail is AVIF', async () => {
    const prepared = await prepareReferenceAssets([
      asset({
        id: 'png-original',
        imageId: 'png-original',
        name: 'product.png',
        dataUrl: pngDataUrl,
        thumbnailDataUrl: avifDataUrl,
      }),
    ])
    expect(prepared[0].converted).toBe(false)
    expect(prepared[0].outputKind).toBe('png')
    sameBytes(parseDataUrl(prepared[0].dataUrl).bytes, pngBytes)
  })

  it('converts an old-session AVIF original even if the thumbnail is already PNG', async () => {
    const prepared = await prepareReferenceAssets([
      asset({
        id: 'avif-original',
        imageId: 'avif-original',
        name: 'product.avif',
        dataUrl: avifDataUrl,
        thumbnailDataUrl: pngDataUrl,
      }),
    ], { encodePng: encodeToPng() })
    expect(prepared[0].converted).toBe(true)
    expect(prepared[0].detected).toBe('avif')
    expect(detectImageKind(parseDataUrl(prepared[0].dataUrl).bytes)).toBe('png')
  })

  it('loads a persisted asset that only has imageId and still converts AVIF', async () => {
    const prepared = await prepareReferenceAssets([
      asset({ id: 'stored-avif', imageId: 'stored-avif', name: 'hydrated.avif' }),
    ], {
      encodePng: encodeToPng(),
      loadStoredImage: async (id) => id === 'stored-avif' ? { dataUrl: avifDataUrl } : undefined,
    })
    expect(prepared[0].converted).toBe(true)
    expect(prepared[0].detected).toBe('avif')
  })

  it('keeps a mixed PNG + JPEG set without re-encoding', async () => {
    const prepared = await prepareReferenceAssets([
      asset({ id: 'a', imageId: 'a', name: 'a.png', dataUrl: pngDataUrl }),
      asset({ id: 'b', imageId: 'b', name: 'b.jpg', dataUrl: jpegDataUrl }),
    ])
    expect(prepared.map((item) => item.outputKind)).toEqual(['png', 'jpeg'])
    expect(prepared.every((item) => !item.converted)).toBe(true)
  })

  it('stops the whole batch when one image cannot be prepared, before any request would be sent', async () => {
    await expect(prepareReferenceAssets([
      asset({ id: 'ok', imageId: 'ok', name: 'ok.png', dataUrl: pngDataUrl }),
      asset({ id: 'bad', imageId: 'bad', name: 'bad.avif', dataUrl: bytesToImageDataUrl('image/avif', truncatedAvif) }),
    ], {
      encodePng: async () => {
        throw new Error('decode failed')
      },
    })).rejects.toSatisfy((error: unknown) => (
      error instanceof ReferenceImageError && error.message.includes('bad.avif')
    ))
  })

  it('explains a missing original instead of falling back to a thumbnail', async () => {
    await expect(prepareReferenceAssets([
      asset({
        id: 'missing',
        imageId: 'missing',
        name: 'gone.avif',
        thumbnailDataUrl: avifDataUrl,
      }),
    ], { loadStoredImage: async () => undefined })).rejects.toSatisfy((error: unknown) => (
      error instanceof ReferenceImageError
      && error.message.includes('gone.avif')
      && error.message.includes('缺少可读取的原图')
    ))
  })
})
