import { describe, expect, it } from 'vitest'
import { TEXT_PRIMARY_PRESETS } from './colors'
import { frameFromPixels, frameFromPreset } from './frameSpec'
import { APPEARANCE_LOCK, assembleImagePrompt, buildColorInstruction, buildPlanUserPrompt, PLAN_SYSTEM_PROMPT, promptContainsAppearanceLock } from './prompts'

const pixelParsed = frameFromPixels(800, 1000)
const pixelFrame = pixelParsed.ok ? pixelParsed.frame : frameFromPreset('1:1')
const assets = [{ name: 'pan.png', width: 1000, height: 1000 }]
const sellingPoints = [{ id: '1', text: '导热快', bindIndex: 2 }]

describe('pdd prompts', () => {
  it('keeps the absolute appearance lock in the planning system prompt', () => {
    expect(promptContainsAppearanceLock(PLAN_SYSTEM_PROMPT)).toBe(true)
    expect(PLAN_SYSTEM_PROMPT).toContain('主图优先视觉吸引力')
    expect(PLAN_SYSTEM_PROMPT).toContain('避免整张纯白底')
    expect(PLAN_SYSTEM_PROMPT).toContain('禁止把场景硬切一半')
  })

  it('injects the lock into every assembled image prompt', () => {
    const assembled = assembleImagePrompt({
      role: 'hero',
      title: '主标题',
      imagePrompt: '明亮客厅里突出产品，少量文字点缀。',
    })
    expect(assembled.startsWith(APPEARANCE_LOCK)).toBe(true)
    expect(promptContainsAppearanceLock(assembled)).toBe(true)
    expect(assembled).toContain('主图规则')
  })

  it('does not duplicate the lock when the model already wrote it', () => {
    const assembled = assembleImagePrompt({
      role: 'usage',
      imagePrompt: `${APPEARANCE_LOCK}\n孩子正在真实动手玩耍。`,
    })
    expect(assembled.split('绝对指令：').length).toBe(2)
    expect(assembled).toContain('禁止把场景硬切一半')
  })

  it('builds a category-agnostic user prompt and does not invent facts', () => {
    const text = buildPlanUserPrompt({
      productName: '不粘煎锅',
      category: '厨具',
      count: 6,
      frameSpec: frameFromPreset('1:1'),
      sellingPoints,
      extraNotes: '',
      assets,
    })
    expect(text).toContain(APPEARANCE_LOCK)
    expect(text).toContain('厨具')
    expect(text).toContain('绑定第 2 张')
    expect(text).toContain('AI 自动')
    expect(text).not.toContain('默认写成玩具')
  })

  it('injects a selected text primary color and asks AI to pick the contrast color', () => {
    const navy = TEXT_PRIMARY_PRESETS[0]
    const text = buildPlanUserPrompt({
      productName: '工程车套装',
      category: '玩具',
      count: 2,
      frameSpec: pixelFrame,
      textPrimaryColor: navy,
      sellingPoints,
      extraNotes: '',
      assets,
    })
    expect(text).toContain('深海蓝')
    expect(text).toContain('#1D4ED8')
    expect(text).toContain('800×1000px')
    expect(text).toContain('自主挑选 1 个鲜明')
    expect(buildColorInstruction(null)).toContain('AI 自动')
    expect(buildColorInstruction(navy)).toContain('#1D4ED8')
  })

  it('appends color and frame constraints when a single-image prompt omitted them', () => {
    const assembled = assembleImagePrompt({
      role: 'hero',
      imagePrompt: `${APPEARANCE_LOCK}\n产品居中，少量文字。`,
      frameSpec: pixelFrame,
      textPrimaryColor: TEXT_PRIMARY_PRESETS[0],
    })
    expect(assembled).toContain('#1D4ED8')
    expect(assembled).toContain('深海蓝')
    expect(assembled).toContain('800×1000')
    expect(promptContainsAppearanceLock(assembled)).toBe(true)
  })

  it('does not duplicate the color constraint when the prompt already names the hex', () => {
    const assembled = assembleImagePrompt({
      role: 'hero',
      imagePrompt: `${APPEARANCE_LOCK}\n主标题用深海蓝 #1D4ED8。`,
      textPrimaryColor: TEXT_PRIMARY_PRESETS[0],
    })
    expect(assembled.split('#1D4ED8').length).toBe(2)
  })
})
