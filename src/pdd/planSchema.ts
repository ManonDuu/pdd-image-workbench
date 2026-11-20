import { IMAGE_ROLES, type DesignDirection, type FrameSpec, type ImageRole, type StoryboardCard } from './types'
import type { TextPrimaryColor } from './colors'
import { DEFAULT_FRAME, frameFromPreset, parseFrameString } from './frameSpec'
import { assembleImagePrompt } from './prompts'

export interface ParsedPlan {
  designDirection: DesignDirection
  cards: Omit<StoryboardCard, 'id' | 'status'>[]
}

export interface PlanParseResult {
  ok: boolean
  error?: string
  plan?: ParsedPlan
  rawText?: string
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1].trim() : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('策划结果里没有找到 JSON 对象')
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function asRole(value: unknown, index: number): ImageRole {
  const raw = asString(value).toLowerCase().replace(/-/g, '_')
  if ((IMAGE_ROLES as readonly string[]).includes(raw)) return raw as ImageRole
  if (index === 0) return 'hero'
  return 'selling_point'
}

export function parsePlanResponse(
  text: string,
  expectedCount: number,
  fallbackFrame: FrameSpec = DEFAULT_FRAME,
  textPrimaryColor?: TextPrimaryColor | null,
): PlanParseResult {
  if (!text || !text.trim()) {
    return { ok: false, error: '策划接口返回为空', rawText: text }
  }
  let data: unknown
  try {
    data = extractJsonObject(text)
  } catch (err) {
    return {
      ok: false,
      error: `策划结果不是可用的 JSON：${err instanceof Error ? err.message : String(err)}`,
      rawText: text,
    }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: '策划 JSON 不是对象', rawText: text }
  }
  const record = data as Record<string, unknown>
  const directionRaw = (record.design_direction ?? record.designDirection ?? {}) as Record<string, unknown>
  const designDirection: DesignDirection = {
    palette: asString(directionRaw.palette),
    contrast: asString(directionRaw.contrast),
    styleSummary: asString(directionRaw.style_summary ?? directionRaw.styleSummary),
  }
  const images = record.images ?? record.cards
  if (!Array.isArray(images) || images.length === 0) {
    return { ok: false, error: '策划 JSON 缺少 images 数组', rawText: text }
  }
  if (images.length !== expectedCount) {
    return {
      ok: false,
      error: `策划张数不匹配：需要 ${expectedCount} 张，实际返回 ${images.length} 张`,
      rawText: text,
    }
  }

  const cards: Omit<StoryboardCard, 'id' | 'status'>[] = []
  for (let i = 0; i < images.length; i += 1) {
    const item = (images[i] ?? {}) as Record<string, unknown>
    const title = asString(item.title)
    const subtitle = asString(item.subtitle)
    const role = asRole(item.role, i)
    const imagePrompt = asString(item.image_prompt ?? item.imagePrompt ?? item.prompt)
    if (!imagePrompt) {
      return { ok: false, error: `第 ${i + 1} 张缺少 image_prompt`, rawText: text }
    }
    // 新规划默认沿用用户指定的全局画幅，避免模型把自定义尺寸改掉；单张稍后仍可手动修改。
    const parsedFrame = parseFrameString(asString(item.aspect_ratio ?? item.aspectRatio ?? item.size), fallbackFrame)
    const frameSpec = fallbackFrame
    const aspectRatio = frameSpec.inputMode === 'preset' && frameSpec.preset ? frameSpec.preset : (parsedFrame.preset ?? '1:1')
    const assembled = assembleImagePrompt({
      imagePrompt,
      title,
      subtitle,
      role,
      frameSpec,
      textPrimaryColor,
    })
    cards.push({
      index: i + 1,
      role,
      aspectRatio,
      frameSpec,
      title: title || `第 ${i + 1} 张`,
      subtitle,
      sceneSummary: asString(item.scene_summary ?? item.sceneSummary),
      layoutSummary: asString(item.layout_summary ?? item.layoutSummary),
      imagePrompt: assembled,
      error: null,
      taskId: null,
      resultImageId: null,
      resultQuality: null,
      resultSizeLabel: null,
    })
  }

  return { ok: true, plan: { designDirection, cards } }
}

export { frameFromPreset }
