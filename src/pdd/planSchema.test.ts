import { describe, expect, it } from 'vitest'
import { TEXT_PRIMARY_PRESETS } from './colors'
import { frameFromPixels, frameFromPreset } from './frameSpec'
import { parsePlanResponse } from './planSchema'
import { promptContainsAppearanceLock } from './prompts'

describe('parsePlanResponse', () => {
  const sample = {
    design_direction: { palette: '主色深海蓝 #1D4ED8，撞色亮橙点缀，因为商品以黄黑为主避免再叠黄', contrast: '有节奏变化', style_summary: '生活场景套图' },
    images: [
      { index: 1, role: 'hero', aspect_ratio: '800x1000', title: '主图', subtitle: '突出产品', scene_summary: '静物', layout_summary: '轻文字', image_prompt: '产品居中，少量点缀文字。' },
      { index: 2, role: 'usage', aspect_ratio: '4:5', title: '使用', subtitle: '动手玩', scene_summary: '互动', layout_summary: '文案在留白', image_prompt: '完整场景展开。' },
    ],
  }

  it('accepts exact counts, keeps custom 800×1000, and injects appearance lock plus color', () => {
    const fallback = frameFromPixels(800, 1000)
    expect(fallback.ok).toBe(true)
    if (!fallback.ok) return
    const result = parsePlanResponse(JSON.stringify(sample), 2, fallback.frame, TEXT_PRIMARY_PRESETS[0])
    expect(result.ok).toBe(true)
    expect(result.plan?.cards).toHaveLength(2)
    expect(result.plan?.cards[0].frameSpec).toEqual({ inputMode: 'pixels', width: 800, height: 1000 })
    expect(result.plan?.cards[1].frameSpec.inputMode).toBe('pixels')
    expect(result.plan?.designDirection.palette).toContain('深海蓝')
    expect(promptContainsAppearanceLock(result.plan!.cards[0].imagePrompt)).toBe(true)
    expect(result.plan!.cards[0].imagePrompt).toContain('#1D4ED8')
  })

  it('still accepts preset ratios when the user stayed on 1:1', () => {
    const presetSample = {
      ...sample,
      images: sample.images.map((item, i) => ({ ...item, aspect_ratio: '1:1', image_prompt: i === 0 ? item.image_prompt : item.image_prompt })),
    }
    const result = parsePlanResponse(JSON.stringify(presetSample), 2, frameFromPreset('1:1'))
    expect(result.ok).toBe(true)
    expect(result.plan?.cards[0].frameSpec.preset).toBe('1:1')
  })

  it('extracts JSON from markdown fences', () => {
    const result = parsePlanResponse(`here is the plan\n\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``, 2, frameFromPreset('1:1'))
    expect(result.ok).toBe(true)
  })

  it('fails clearly when the count does not match', () => {
    const result = parsePlanResponse(JSON.stringify(sample), 6, frameFromPreset('1:1'))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('张数不匹配')
  })

  it('fails clearly when image_prompt is missing', () => {
    const broken = { ...sample, images: [{ role: 'hero', title: 'x' }] }
    const result = parsePlanResponse(JSON.stringify(broken), 1, frameFromPreset('1:1'))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('image_prompt')
  })
})
