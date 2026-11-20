import type { InputImage } from '../types'
import { storeImage } from '../lib/db'
import { cacheImage } from '../lib/imageCache'
import { prepareReferenceAssets, type EncodePngFn, type LoadStoredImageFn } from './referenceImage'
import type { ProductAsset } from './types'

/**
 * 为生图任务准备参考图。必须用 storeImage 返回的新 ID，而不能沿用商品原图的 imageId。
 * 否则 executeTask 会按旧 ID 从缓存/IndexedDB 读回 AVIF 等原件，把已经转好的 PNG 覆盖掉。
 */
export async function collectInputImages(
  assets: ProductAsset[],
  options?: {
    encodePng?: EncodePngFn
    loadStoredImage?: LoadStoredImageFn
    persistImage?: (dataUrl: string) => Promise<string>
    cachePersistedImage?: (id: string, dataUrl: string) => void
  },
): Promise<InputImage[]> {
  const prepared = await prepareReferenceAssets(assets, options)
  const persistImage = options?.persistImage ?? storeImage
  const cachePersistedImage = options?.cachePersistedImage ?? cacheImage
  const result: InputImage[] = []
  for (const item of prepared) {
    const id = await persistImage(item.dataUrl)
    cachePersistedImage(id, item.dataUrl)
    result.push({ id, dataUrl: item.dataUrl })
  }
  return result
}
