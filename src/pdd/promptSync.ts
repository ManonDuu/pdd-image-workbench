import type { StoryboardCard } from './types'

export const PROMPT_FIELD_KEYS = ['title', 'subtitle', 'sceneSummary', 'layoutSummary'] as const
export type PromptFieldKey = (typeof PROMPT_FIELD_KEYS)[number]

export type CardPromptFields = Pick<StoryboardCard, PromptFieldKey>
export type PromptEditableCard = CardPromptFields & {
  imagePrompt: string
  lastStructuredEditAt?: number
  lastPromptEditAt?: number
}

export const PRIORITY_BLOCK_TITLE = '【单张生效文案与排版，优先于上文冲突描述】'

const FIELD_LABELS: Record<PromptFieldKey, string> = {
  title: '主标题',
  subtitle: '副标题',
  sceneSummary: '场景',
  layoutSummary: '排版',
}

const PRIORITY_BLOCK_RE = /(?:\n*)【单张生效文案与排版，优先于上文冲突描述】[\s\S]*$/

export function describePromptField(key: PromptFieldKey, value: string): string {
  const trimmed = value.trim()
  if (key === 'subtitle' && !trimmed) return '（无，不要再放置副标题）'
  return trimmed || '（无）'
}

export function buildPriorityBlock(fields: CardPromptFields): string {
  return [
    PRIORITY_BLOCK_TITLE,
    ...PROMPT_FIELD_KEYS.map((key) => `${FIELD_LABELS[key]}：${describePromptField(key, fields[key])}`),
  ].join('\n')
}

function stripPriorityBlock(prompt: string): string {
  return prompt.replace(PRIORITY_BLOCK_RE, '').trimEnd()
}

function replaceExact(prompt: string, from: string, to: string): string {
  const source = from.trim()
  if (source.length < 2 || source === to.trim() || !prompt.includes(source)) return prompt
  return prompt.split(source).join(to)
}

function alignLabeledCopy(prompt: string, fields: CardPromptFields): string {
  let body = prompt
  const title = fields.title.trim()
  const subtitle = fields.subtitle.trim()
  if (title) body = body.replace(/主标题(?:写|为|是|：|:)?「[^」]*」/g, `主标题写「${title}」`)
  if (subtitle) body = body.replace(/副标题(?:写|为|是|：|:)?「[^」]*」/g, `副标题写「${subtitle}」`)
  else body = body.replace(/副标题(?:写|为|是|：|:)?「[^」]*」/g, '不要再放置副标题')
  return body
}

export function syncPromptWithFieldChanges(
  prompt: string,
  previous: CardPromptFields,
  next: CardPromptFields,
): string {
  let body = stripPriorityBlock(prompt)
  for (const key of PROMPT_FIELD_KEYS) {
    if (previous[key].trim() === next[key].trim()) continue
    body = replaceExact(body, previous[key], describePromptField(key, next[key]))
  }
  body = alignLabeledCopy(body, next)
  return `${body.trim()}\n\n${buildPriorityBlock(next)}`.trim()
}

export function shouldSyncFieldsIntoPrompt(card: Pick<PromptEditableCard, 'lastStructuredEditAt' | 'lastPromptEditAt'>): boolean {
  const promptEditedAt = card.lastPromptEditAt ?? 0
  const fieldsEditedAt = card.lastStructuredEditAt ?? 0
  // 未直接改过最终 Prompt 时，以上方结构化字段为准（含修复前只改了标题/摘要的旧卡片）。
  if (!promptEditedAt) return true
  return fieldsEditedAt >= promptEditedAt
}

export function resolveOutboundImagePrompt(card: PromptEditableCard): string {
  if (!shouldSyncFieldsIntoPrompt(card)) return card.imagePrompt.trim()
  return syncPromptWithFieldChanges(card.imagePrompt, card, card)
}

export function applyCardPatch(card: StoryboardCard, patch: Partial<StoryboardCard>): StoryboardCard {
  const next: StoryboardCard = { ...card, ...patch }
  const fieldsChanged = PROMPT_FIELD_KEYS.some((key) => key in patch && patch[key] !== card[key])
  const promptFromUser = 'imagePrompt' in patch && !fieldsChanged && !('lastStructuredEditAt' in patch)
  if (fieldsChanged) {
    next.imagePrompt = syncPromptWithFieldChanges(card.imagePrompt, card, next)
    next.lastStructuredEditAt = Date.now()
  }
  if (promptFromUser) {
    next.lastPromptEditAt = Date.now()
  }
  return next
}

export function failedCardPatch(
  card: Pick<StoryboardCard, 'taskId' | 'resultImageId'>,
  error: string,
  taskId?: string,
): Partial<StoryboardCard> {
  return {
    status: 'error',
    error,
    taskId: taskId ?? card.taskId,
    // 失败时保留旧图供对照，但不得改成 done，也不得把旧 resultImageId 写成新成功结果。
  }
}

export function succeededCardPatch(input: {
  taskId: string
  resultImageId: string
  width?: number
  height?: number
  quality?: string | null
  sizeLabel?: string | null
  generatedAt?: number
}): Partial<StoryboardCard> {
  return {
    status: 'done',
    error: null,
    taskId: input.taskId,
    resultImageId: input.resultImageId,
    resultWidth: input.width,
    resultHeight: input.height,
    resultQuality: input.quality ?? null,
    resultSizeLabel: input.sizeLabel ?? null,
    generatedAt: input.generatedAt ?? Date.now(),
  }
}
