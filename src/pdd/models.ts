/** 识别模型目录，挑选规划文本模型与生图模型。绝不默认 gpt-image-2.6-sunburst。 */

const IMAGE_MODEL_RE = /(^|[-_/])(gpt-image|dall-e|imagen|flux|sd[-_]?xl|stable-diffusion|midjourney|image-2)/i
const BANNED_DEFAULTS = new Set(['gpt-image-2.6-sunburst'])

export interface ModelPick {
  allIds: string[]
  planningIds: string[]
  imageIds: string[]
  recommendedPlanning?: string
  recommendedImage?: string
}

export function isImageModelId(id: string): boolean {
  return IMAGE_MODEL_RE.test(id)
}

export function extractModelIds(payload: unknown): string[] {
  const ids: string[] = []
  const visit = (value: unknown) => {
    if (!value) return
    if (typeof value === 'string') {
      if (value.trim()) ids.push(value.trim())
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (typeof value === 'object') {
      const rec = value as Record<string, unknown>
      if (typeof rec.id === 'string') ids.push(rec.id.trim())
      else if (typeof rec.model === 'string') ids.push(rec.model.trim())
      if (Array.isArray(rec.data)) rec.data.forEach(visit)
      if (Array.isArray(rec.models)) rec.models.forEach(visit)
    }
  }
  visit(payload)
  return Array.from(new Set(ids.filter(Boolean)))
}

export function pickPlanningModel(ids: string[]): string | undefined {
  const candidates = ids.filter((id) => !isImageModelId(id) && !BANNED_DEFAULTS.has(id))
  const preferred = [
    (id: string) => id === 'gpt-6.2-astra' || id.startsWith('gpt-6.2-astra'),
    (id: string) => /gpt-6\.2/.test(id) && /astra|vision/.test(id),
    (id: string) => /gpt-6/.test(id) && !/image/.test(id),
    (id: string) => /gpt-5/.test(id) && !/image/.test(id),
    (id: string) => /gpt-4o|gpt-4\.1|gpt-4/.test(id),
  ]
  for (const test of preferred) {
    const hit = candidates.find(test)
    if (hit) return hit
  }
  return candidates[0]
}

export function pickImageModel(ids: string[]): string | undefined {
  const usable = ids.filter((id) => !BANNED_DEFAULTS.has(id))
  const preferred = ['gpt-image-2.6', 'gpt-image-2.5']
  for (const name of preferred) {
    if (usable.includes(name)) return name
  }
  const fuzzy = usable.find((id) => /^gpt-image-2\.(6|5)(?!.*sunburst)/.test(id))
  if (fuzzy) return fuzzy
  return usable.find((id) => isImageModelId(id) && !/sunburst/i.test(id))
}

export function classifyModels(payload: unknown): ModelPick {
  const allIds = extractModelIds(payload)
  const planningIds = allIds.filter((id) => !isImageModelId(id) && !BANNED_DEFAULTS.has(id))
  const imageIds = allIds.filter((id) => isImageModelId(id) && !BANNED_DEFAULTS.has(id))
  return {
    allIds,
    planningIds,
    imageIds,
    recommendedPlanning: pickPlanningModel(allIds),
    recommendedImage: pickImageModel(allIds),
  }
}
