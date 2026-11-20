import { describe, expect, it } from 'vitest'
import { APPEARANCE_LOCK, assembleImagePrompt } from './prompts'
import {
  PRIORITY_BLOCK_TITLE,
  applyCardPatch,
  failedCardPatch,
  resolveOutboundImagePrompt,
  succeededCardPatch,
  syncPromptWithFieldChanges,
  shouldSyncFieldsIntoPrompt,
} from './promptSync'
import { frameFromPreset } from './frameSpec'
import type { StoryboardCard } from './types'

const plannedPrompt = `${APPEARANCE_LOCK}
奶油色台面上摆放六件捏捏乐原图与粉紫包装。
主标题写「今天捏哪款？」，放在画面顶部居中。
副标题写「六款一眼看全」。
场景保持桌面陈列，排版把标题放在上方留白。`

function card(partial: Partial<StoryboardCard> & Pick<StoryboardCard, 'id'>): StoryboardCard {
  return {
    index: 2,
    role: 'usage',
    aspectRatio: '1:1',
    frameSpec: frameFromPreset('1:1'),
    title: '今天捏哪款？',
    subtitle: '六款一眼看全',
    sceneSummary: '奶油色台面陈列六件玩具',
    layoutSummary: '标题放在画面顶部居中',
    imagePrompt: plannedPrompt,
    status: 'done',
    error: null,
    taskId: 'task-old',
    resultImageId: 'img-old',
    ...partial,
  }
}

describe('syncPromptWithFieldChanges', () => {
  it('replaces a structured title and layout in the planned prompt and adds a priority block', () => {
    const synced = syncPromptWithFieldChanges(
      plannedPrompt,
      { title: '今天捏哪款？', subtitle: '六款一眼看全', sceneSummary: '奶油色台面陈列六件玩具', layoutSummary: '标题放在画面顶部居中' },
      { title: '捏一捏，放轻松', subtitle: '六款一眼看全', sceneSummary: '奶油色台面陈列六件玩具', layoutSummary: '主标题放在左下角留白，不要放在顶部' },
    )
    expect(synced).toContain('捏一捏，放轻松')
    expect(synced).toContain('主标题放在左下角留白，不要放在顶部')
    expect(synced).not.toContain('今天捏哪款？')
    expect(synced).not.toContain('标题放在画面顶部居中')
    expect(synced).toContain(PRIORITY_BLOCK_TITLE)
    expect(synced).toContain('六款一眼看全')
  })

  it('clears a subtitle instead of leaving the old line in force', () => {
    const synced = syncPromptWithFieldChanges(
      plannedPrompt,
      { title: '今天捏哪款？', subtitle: '六款一眼看全', sceneSummary: '奶油色台面陈列六件玩具', layoutSummary: '标题放在画面顶部居中' },
      { title: '今天捏哪款？', subtitle: '', sceneSummary: '奶油色台面陈列六件玩具', layoutSummary: '标题放在画面顶部居中' },
    )
    expect(synced).toContain('（无，不要再放置副标题）')
    expect(synced).not.toContain('副标题写「六款一眼看全」')
  })
})

describe('applyCardPatch', () => {
  it('syncs field edits into imagePrompt and does not rewrite other cards', () => {
    const original = card({ id: 'card-2' })
    const other = card({ id: 'card-1', title: '六件套捏捏乐', index: 1 })
    const patched = applyCardPatch(original, { title: '捏一捏，放轻松', layoutSummary: '主标题放在左下角留白，不要放在顶部' })
    const cards = [other, original].map((item) => item.id === original.id ? patched : item)

    expect(cards[0]).toBe(other)
    expect(cards[0].title).toBe('六件套捏捏乐')
    expect(cards[0].imagePrompt).toBe(other.imagePrompt)
    expect(patched.title).toBe('捏一捏，放轻松')
    expect(patched.imagePrompt).toContain('捏一捏，放轻松')
    expect(patched.imagePrompt).not.toContain('今天捏哪款？')
    expect(patched.lastStructuredEditAt).toBeGreaterThan(0)
    expect(patched.lastPromptEditAt).toBeUndefined()
    expect(patched.resultImageId).toBe('img-old')
  })

  it('keeps a direct final-prompt edit and does not overwrite it with stale fields', () => {
    const original = card({ id: 'card-2' })
    const handwritten = `${APPEARANCE_LOCK}\n请把主标题写成「手改专用标题」，放在右侧。`
    const patched = applyCardPatch(original, { imagePrompt: handwritten })
    expect(patched.imagePrompt).toBe(handwritten)
    expect(patched.lastPromptEditAt).toBeGreaterThan(0)
    expect(shouldSyncFieldsIntoPrompt(patched)).toBe(false)
    expect(resolveOutboundImagePrompt(patched)).toBe(handwritten)
    expect(resolveOutboundImagePrompt(patched)).not.toContain('今天捏哪款？')
    expect(resolveOutboundImagePrompt(patched)).toContain('手改专用标题')
  })

  it('after a prompt edit, a later field edit only patches that field and keeps other handwritten text', () => {
    const original = card({ id: 'card-2' })
    const handwritten = `${APPEARANCE_LOCK}\n保留这段手写构图：窗外有阳光。主标题仍先写「今天捏哪款？」。`
    const afterPrompt = applyCardPatch(original, { imagePrompt: handwritten })
    const afterField = applyCardPatch(afterPrompt, { title: '捏一捏，放轻松' })
    expect(afterField.imagePrompt).toContain('窗外有阳光')
    expect(afterField.imagePrompt).toContain('捏一捏，放轻松')
    expect(afterField.imagePrompt).not.toContain('今天捏哪款？')
    expect(shouldSyncFieldsIntoPrompt(afterField)).toBe(true)
  })
})

describe('resolveOutboundImagePrompt and assembleImagePrompt', () => {
  it('uses current title fields even when the stored planned prompt still has the old copy', () => {
    const stale = card({
      id: 'card-2',
      title: '捏一捏，放轻松',
      layoutSummary: '主标题放在左下角留白，不要放在顶部',
    })
    const outbound = resolveOutboundImagePrompt(stale)
    expect(outbound).toContain('捏一捏，放轻松')
    expect(outbound).toContain('主标题写「捏一捏，放轻松」')
    expect(outbound).not.toContain('主标题写「今天捏哪款？」')
    expect(outbound).toContain(PRIORITY_BLOCK_TITLE)
    expect(outbound).toContain('主标题放在左下角留白，不要放在顶部')
  })

  it('uses the latest card fields when redrawing immediately after a title edit', () => {
    const latest = applyCardPatch(card({ id: 'card-2' }), {
      title: '捏一捏，放轻松',
      layoutSummary: '主标题放在左下角留白，不要放在顶部',
    })
    const outbound = assembleImagePrompt({
      ...latest,
      imagePrompt: resolveOutboundImagePrompt(latest),
      textPrimaryColor: null,
    })
    expect(outbound).toContain(APPEARANCE_LOCK)
    expect(outbound).toContain('捏一捏，放轻松')
    expect(outbound).toContain('主标题放在左下角留白，不要放在顶部')
    expect(outbound).not.toContain('今天捏哪款？')
    expect(outbound).not.toContain('标题放在画面顶部居中')
  })
})

describe('generation result patches', () => {
  it('success writes a new task and image id; failure stays error and does not pretend the old image is a new success', () => {
    const existing = card({ id: 'card-2' })
    const success = { ...existing, ...succeededCardPatch({ taskId: 'task-new', resultImageId: 'img-new', width: 1254, height: 1254 }) }
    expect(success.status).toBe('done')
    expect(success.taskId).toBe('task-new')
    expect(success.resultImageId).toBe('img-new')
    expect(success.resultImageId).not.toBe(existing.resultImageId)

    const failed = { ...existing, ...failedCardPatch(existing, '接口失败', 'task-failed') }
    expect(failed.status).toBe('error')
    expect(failed.error).toBe('接口失败')
    expect(failed.taskId).toBe('task-failed')
    expect(failed.resultImageId).toBe('img-old')
  })
})
