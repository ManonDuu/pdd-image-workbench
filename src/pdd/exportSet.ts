import { zip } from 'fflate'
import { dataUrlToBytes } from '../lib/dataUrl'
import { getImage } from '../lib/db'
import { customPixelTarget } from './frameSpec'
import type { StoryboardCard } from './types'

function zipAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 0 }, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function triggerDownload(href: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/** 居中无变形 cover：放大铺满目标画幅后裁切多余边缘，避免把画面拉扁拉长。 */
export function computeCoverDraw(srcW: number, srcH: number, destW: number, destH: number) {
  const scale = Math.max(destW / srcW, destH / srcH)
  const width = srcW * scale
  const height = srcH * scale
  return {
    scale,
    dx: (destW - width) / 2,
    dy: (destH - height) / 2,
    dw: width,
    dh: height,
  }
}

export async function resizeCoverPng(dataUrl: string, width: number, height: number): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('缩放失败：无法读取原图'))
    img.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  const draw = computeCoverDraw(image.width, image.height, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, draw.dx, draw.dy, draw.dw, draw.dh)
  return canvas.toDataURL('image/png')
}

export async function downloadOriginalPng(imageId: string, filename: string): Promise<void> {
  const image = await getImage(imageId)
  if (!image?.dataUrl) throw new Error('找不到原图，无法下载')
  triggerDownload(image.dataUrl, filename.endsWith('.png') ? filename : `${filename}.png`)
}

export async function downloadCustomSizePng(imageId: string, width: number, height: number, filename: string): Promise<void> {
  const image = await getImage(imageId)
  if (!image?.dataUrl) throw new Error('找不到原图，无法导出')
  const dataUrl = await resizeCoverPng(image.dataUrl, width, height)
  triggerDownload(dataUrl, filename.endsWith('.png') ? filename : `${filename}.png`)
}

export async function downloadSetZip(
  cards: StoryboardCard[],
  zipName = 'pdd-image-set.zip',
  options?: { customPixels?: boolean },
): Promise<number> {
  const files: Record<string, Uint8Array> = {}
  for (const card of cards) {
    if (!card.resultImageId) continue
    const image = await getImage(card.resultImageId)
    if (!image?.dataUrl) continue
    const label = String(card.index).padStart(2, '0')
    const role = card.role || 'image'
    const target = customPixelTarget(card.frameSpec)
    if (options?.customPixels && target) {
      const resized = await resizeCoverPng(image.dataUrl, target.width, target.height)
      const { bytes } = dataUrlToBytes(resized)
      files[`pdd-${label}-${role}-${target.width}x${target.height}-cover.png`] = bytes
    } else {
      const { bytes } = dataUrlToBytes(image.dataUrl)
      files[`pdd-${label}-${role}.png`] = bytes
    }
  }
  const names = Object.keys(files)
  if (!names.length) throw new Error(options?.customPixels ? '还没有可按自定义尺寸打包的原图' : '还没有可打包的原图')
  const zipped = await zipAsync(files)
  const blob = new Blob([toArrayBuffer(zipped)], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, zipName)
  URL.revokeObjectURL(url)
  return names.length
}
