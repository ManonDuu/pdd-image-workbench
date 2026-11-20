import { getImage, getImageDimensions, getImageThumbnail, storeImageWithSize } from '../lib/db'
import { isImageFileCandidate, parseDataUrl, ReferenceImageError } from './referenceImage'
import type { ProductAsset } from './types'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`))
    reader.readAsDataURL(file)
  })
}

export async function importProductFiles(files: File[]): Promise<ProductAsset[]> {
  const assets: ProductAsset[] = []
  const skipped: string[] = []
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file)
    let bytes: Uint8Array | undefined
    try {
      bytes = parseDataUrl(dataUrl).bytes
    } catch {
      skipped.push(file.name)
      continue
    }
    if (!isImageFileCandidate(file, bytes)) {
      skipped.push(file.name)
      continue
    }
    const stored = await storeImageWithSize(dataUrl, 'upload')
    const thumb = await getImageThumbnail(stored.id)
    assets.push({
      id: stored.id,
      imageId: stored.id,
      name: file.name,
      width: stored.width,
      height: stored.height,
      dataUrl,
      thumbnailDataUrl: thumb?.thumbnailDataUrl || dataUrl,
    })
  }
  if (!assets.length && skipped.length) {
    throw new ReferenceImageError(`没有识别到可上传的图片文件。已跳过：${skipped.join('、')}`)
  }
  return assets
}

export async function hydrateAssets(assets: ProductAsset[]): Promise<ProductAsset[]> {
  const next: ProductAsset[] = []
  for (const asset of assets) {
    const image = await getImage(asset.imageId)
    const dims = await getImageDimensions(asset.imageId)
    const thumb = await getImageThumbnail(asset.imageId)
    next.push({
      ...asset,
      width: dims?.width ?? asset.width,
      height: dims?.height ?? asset.height,
      dataUrl: image?.dataUrl,
      thumbnailDataUrl: thumb?.thumbnailDataUrl || image?.dataUrl,
    })
  }
  return next
}

export async function loadImageDataUrl(imageId: string): Promise<string | undefined> {
  const image = await getImage(imageId)
  return image?.dataUrl
}
