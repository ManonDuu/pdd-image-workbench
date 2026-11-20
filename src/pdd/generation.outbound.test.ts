import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import { createDefaultOpenAIProfile, createSettingsForApiProfile, DEFAULT_SETTINGS } from '../lib/apiProfiles'
import { persistTaskInputImages } from '../lib/inputImages'
import { cacheImage, clearImageCaches, ensureImageCached } from '../lib/imageCache'
import { callOpenAICompatibleImageApi } from '../lib/openaiCompatibleImageApi'
import { hashDataUrl } from '../lib/db'
import { bytesToImageDataUrl, detectImageKind, parseDataUrl, PNG_SIGNATURE } from './referenceImage'
import { collectInputImages } from './generationInputs'
import type { ProductAsset } from './types'
import type { InputImage } from '../types'

const memory = vi.hoisted(() => new Map<string, string>())

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return {
    ...actual,
    storeImage: vi.fn(async (dataUrl: string) => {
      const id = await actual.hashDataUrl(dataUrl)
      memory.set(id, dataUrl)
      return id
    }),
    getImage: vi.fn(async (id: string) => {
      const dataUrl = memory.get(id)
      return dataUrl ? { id, dataUrl, createdAt: 1, source: 'upload' as const } : undefined
    }),
  }
})

const pngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAALklEQVR4nGO8o6bmqLGJgWjAKOt3g3jVDAwMTCSpZhjVQBxgIlIdHIxqYCACAACzgQOlE/HZRwAAAABJRU5ErkJggg==').split('').map((c) => c.charCodeAt(0)))
const jpegBytes = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD59JLEknJPUmkoor+zElFWWx+QNuTbbu2f/9k=').split('').map((c) => c.charCodeAt(0)))
const avifBytes = Uint8Array.from(atob('AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAKwAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAEAAAABAAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAM21kYXQSAAoJGAz/2iAhoNCAMhxFMeHhmUCCCCeUAAAAOtxF0s99ZXknVWriBG6A').split('').map((c) => c.charCodeAt(0)))

const pngDataUrl = bytesToImageDataUrl('image/png', pngBytes)
const jpegDataUrl = bytesToImageDataUrl('image/jpeg', jpegBytes)
const avifDataUrl = bytesToImageDataUrl('image/avif', avifBytes)
const pngBase64 = pngDataUrl.split(',')[1] || ''

function asset(partial: Partial<ProductAsset> & Pick<ProductAsset, 'id' | 'imageId' | 'name'>): ProductAsset {
  return { width: 16, height: 16, ...partial }
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  expect(Array.from(left)).toEqual(Array.from(right))
}

async function seedStoredImage(dataUrl: string, preCache = true) {
  const id = await hashDataUrl(dataUrl)
  memory.set(id, dataUrl)
  if (preCache) cacheImage(id, dataUrl)
  return id
}

async function reloadLikeExecuteTask(ids: string[]) {
  const dataUrls: string[] = []
  for (const id of ids) {
    const dataUrl = await ensureImageCached(id)
    if (!dataUrl) throw new Error(`输入图片已不存在: ${id}`)
    dataUrls.push(dataUrl)
  }
  return dataUrls
}

type CapturedAttachment = {
  field: string
  filename: string
  mime: string
  byteLength: number
  kind: ReturnType<typeof detectImageKind>
  signature: number[]
  bytes: Uint8Array
}

type CapturedRequest = {
  url: string
  method: string
  pathname: string
  contentType: string
  attachments: CapturedAttachment[]
  fieldNames: string[]
}

function installFetchCapture() {
  const originalFetch = globalThis.fetch
  const captured: CapturedRequest[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return originalFetch(input, init)
    }
    const request = input instanceof Request ? input : new Request(input, init)
    const contentType = request.headers.get('content-type') || ''
    const fieldNames: string[] = []
    const attachments: CapturedAttachment[] = []
    if (contentType.includes('multipart/form-data')) {
      const form = await request.clone().formData()
      for (const [name, value] of form.entries()) {
        fieldNames.push(name)
        if (typeof value === 'string') continue
        const file = value as File
        const bytes = new Uint8Array(await file.arrayBuffer())
        attachments.push({
          field: name,
          filename: file.name,
          mime: file.type,
          byteLength: bytes.byteLength,
          kind: detectImageKind(bytes),
          signature: Array.from(bytes.subarray(0, 12)),
          bytes,
        })
      }
    }
    captured.push({
      url: request.url,
      method: request.method,
      pathname: new URL(request.url).pathname,
      contentType,
      attachments,
      fieldNames,
    })
    return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  return {
    captured,
    restore() {
      globalThis.fetch = originalFetch
    },
  }
}

async function outboundFromPersistedAsset(
  storedDataUrl: string,
  options?: { encodePng?: (dataUrl: string) => Promise<string>; name?: string },
) {
  const imageId = await seedStoredImage(storedDataUrl, true)
  const prepared = await collectInputImages([
    asset({
      id: 'persisted-asset',
      imageId,
      name: options?.name ?? 'product',
    }),
  ], { encodePng: options?.encodePng })
  const persisted = await persistTaskInputImages(prepared, true)
  const reloaded = await reloadLikeExecuteTask(persisted.map((item) => item.id))
  const hook = installFetchCapture()
  try {
    const profile = createDefaultOpenAIProfile({
      baseUrl: 'http://127.0.0.1:9/v1',
      apiKey: 'unit-test-key',
      model: 'gpt-image-2.6',
      apiMode: 'images',
      timeout: 5,
      streamImages: false,
      codexCli: false,
      apiProxy: false,
    })
    await callOpenAICompatibleImageApi({
      settings: createSettingsForApiProfile(DEFAULT_SETTINGS, profile),
      prompt: 'unit test prompt',
      params: { ...DEFAULT_PARAMS, n: 1, output_format: 'png' },
      inputImageDataUrls: reloaded,
    }, profile)
  } finally {
    hook.restore()
  }
  return {
    originalId: imageId,
    prepared,
    persisted,
    reloaded,
    request: hook.captured[0],
  }
}

beforeEach(() => {
  memory.clear()
  clearImageCaches()
})

afterEach(() => {
  memory.clear()
  clearImageCaches()
})

describe('generation outbound path from persisted records', () => {
  it('converts an old AVIF IndexedDB record into a PNG multipart attachment after ID reload', async () => {
    const result = await outboundFromPersistedAsset(avifDataUrl, {
      name: '71bPS+eLk3L._AC_SL1500_.avif',
      encodePng: async () => pngDataUrl,
    })

    expect(result.prepared).toHaveLength(1)
    expect(result.prepared[0].id).not.toBe(result.originalId)
    expect(memory.get(result.originalId)).toBe(avifDataUrl)
    sameBytes(parseDataUrl(result.prepared[0].dataUrl).bytes, pngBytes)
    expect(result.persisted.map((item: InputImage) => item.id)).toEqual([result.prepared[0].id])
    sameBytes(parseDataUrl(result.reloaded[0]).bytes, pngBytes)
    expect(detectImageKind(parseDataUrl(result.reloaded[0]).bytes)).toBe('png')

    expect(result.request).toBeTruthy()
    expect(result.request.method).toBe('POST')
    expect(result.request.pathname).toMatch(/\/images\/edits$/)
    expect(result.request.contentType).toContain('multipart/form-data')
    expect(result.request.attachments).toHaveLength(1)
    const part = result.request.attachments[0]
    expect(part.field).toBe('image[]')
    expect(part.filename).toBe('input-1.png')
    expect(part.mime).toBe('image/png')
    expect(part.kind).toBe('png')
    expect(part.signature.slice(0, 8)).toEqual(Array.from(PNG_SIGNATURE))
    sameBytes(part.bytes, pngBytes)
  })

  it('keeps a persisted PNG unchanged for the free-generation / already-compatible path', async () => {
    const result = await outboundFromPersistedAsset(pngDataUrl, { name: 'product.png' })
    expect(result.prepared[0].id).toBe(result.originalId)
    sameBytes(parseDataUrl(result.reloaded[0]).bytes, pngBytes)
    expect(result.request.pathname).toMatch(/\/images\/edits$/)
    const part = result.request.attachments[0]
    expect(part.filename).toBe('input-1.png')
    expect(part.mime).toBe('image/png')
    expect(part.kind).toBe('png')
    sameBytes(part.bytes, pngBytes)
  })

  it('keeps a persisted JPEG as JPEG bytes, MIME and filename', async () => {
    const result = await outboundFromPersistedAsset(jpegDataUrl, { name: 'product.jpg' })
    expect(result.prepared[0].id).toBe(result.originalId)
    sameBytes(parseDataUrl(result.reloaded[0]).bytes, jpegBytes)
    const part = result.request.attachments[0]
    expect(part.filename).toBe('input-1.jpeg')
    expect(part.mime).toBe('image/jpeg')
    expect(part.kind).toBe('jpeg')
    sameBytes(part.bytes, jpegBytes)
  })
})
