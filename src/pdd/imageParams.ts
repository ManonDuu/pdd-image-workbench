import type { TaskParams } from '../types'
import { normalizeImageSize } from '../lib/size'
import { describeFrame, frameFromPreset, frameRatioLabel, simplifyRatio } from './frameSpec'
import type { AspectRatio, FrameSpec } from './types'

/**
 * Cockpit / gpt-image-2.6 走 OpenAI 兼容 Images API（callImagesApiSingle）：
 * 实际请求只发送 params.size；normalizeParamsForSettings 会清掉 aspect_ratio。
 * 因此自定义画幅必须写成合法的 size 字符串，并在 prompt 中补充目标比例，避免 HTTP 400。
 * 自定义像素会经过 normalizeImageSize（16 的倍数、边长/总像素/宽高比约束）。
 * 例如目标 800×1000 会请求 800x1008（1000 不是 16 的倍数）。
 */

const PRESET_REQUEST_SIZE: Record<AspectRatio, string> = {
  '1:1': '1024x1024',
  '3:4': '768x1024',
  '4:3': '1024x768',
  '9:16': '720x1280',
  '16:9': '1280x720',
}

export function fallbackSizeForRatio(ratio: AspectRatio): string {
  return PRESET_REQUEST_SIZE[ratio]
}

export function requestSizeForFrame(spec: FrameSpec): string {
  if (spec.inputMode === 'preset' && spec.preset) {
    return PRESET_REQUEST_SIZE[spec.preset]
  }
  if (spec.inputMode === 'pixels') {
    return normalizeImageSize(`${spec.width}x${spec.height}`)
  }
  const ratio = simplifyRatio(spec.width, spec.height)
  const maxSide = 1280
  let width: number
  let height: number
  if (ratio.width >= ratio.height) {
    width = maxSide
    height = Math.max(1, Math.round(maxSide * ratio.height / ratio.width))
  } else {
    height = maxSide
    width = Math.max(1, Math.round(maxSide * ratio.width / ratio.height))
  }
  return normalizeImageSize(`${width}x${height}`)
}

export function buildImageTaskParams(base: TaskParams, spec: FrameSpec): TaskParams {
  return {
    ...base,
    n: 1,
    size: requestSizeForFrame(spec),
    aspect_ratio: undefined,
    quality: 'auto',
    output_format: 'png',
  }
}

export function framePromptHint(spec: FrameSpec): string {
  const ratio = frameRatioLabel(spec)
  if (spec.inputMode === 'pixels') {
    const requestSize = requestSizeForFrame(spec)
    return `画幅要求：按 ${ratio} 构图完整安排画面，目标导出尺寸为 ${spec.width}×${spec.height} 像素（接口可能按模型约束规整为 ${requestSize.replace('x', '×')}）。请把主体与文案安全区放在此比例内，不要为了填满而拉伸变形产品。`
  }
  return `画幅要求：按 ${describeFrame(spec)} 构图完整安排画面。请把主体与文案安全区放在此比例内，不要为了填满而拉伸变形产品。`
}

export function formatPixelSize(width?: number, height?: number): string | null {
  if (!width || !height) return null
  return `${width}×${height}`
}

export function isAspectRatio(value: string): value is AspectRatio {
  return value in PRESET_REQUEST_SIZE
}

export { frameFromPreset }
