import type { TextPrimaryColor } from './colors'
import { describeTextPrimaryColor } from './colors'
import { describeFrame } from './frameSpec'
import { framePromptHint } from './imageParams'
import type { FrameSpec, ProductAsset, SellingPoint } from './types'

/** t57 绝对外观锁定：策划与每张生图 Prompt 都必须写入。 */
export const APPEARANCE_LOCK =
  '绝对指令：严格保持参考图中真实产品的原始外观、整体造型、部件结构、配色比例、配件数量与可见细节/标识，不允许改变产品外观、变形、替换核心组件或捏造未提供的配件/功能。'

export const HERO_RULE =
  '主图规则：主图优先视觉吸引力与突出产品主体，文字只做少量精炼点缀，不堆满卖点，不用过大的标题栏或大色块抢占产品焦点。'

export const COLORFUL_SCENE_RULE =
  '丰富有色场景规则：详情图和后续图片默认采用有色彩、真实贴合卖点的丰富生活/使用场景，避免整张纯白底，同时保持主体突出、文字清楚、整套配色呼应。场景要服务卖点，不要为了加颜色而堆装饰。'

export const COMPOSITION_RULE =
  '场景构图规则：使用场景图要让互动和画面完整展开，文案顺着自然留白少量融入。禁止把场景硬切一半、用满高空色块栏只放几个字。允许左右构图，但文字栏不得挤掉完整场景。'

export const COMMERCE_RULE =
  '电商转化与原生中文排版：根据张数和类目自动安排 1–2 张真实使用互动场景（如玩具呈现孩子真实动手玩耍，其他类目呈现真实消费使用场景），整套有统一的主色/撞色体系但每张版式有节奏变化，主副标题字号与行距有呼吸感，中文直接由图像模型原生融合排版，不后期生硬叠字。文案要生动，不要单调地把所有字贴在同一侧。'

export const PLAN_SYSTEM_PROMPT = `你是跨品类电商（含拼多多等平台）套图策划编辑。根据用户提供的商品参考图、张数、比例/尺寸和卖点，规划一整套可直接用于生图的中文方案。只输出一个 JSON 对象，不要 markdown 代码围栏，不要解释。

必须同时遵守以下规则：
1. ${APPEARANCE_LOCK}
2. ${HERO_RULE}
3. ${COLORFUL_SCENE_RULE}
4. ${COMPOSITION_RULE}
5. ${COMMERCE_RULE}
6. 规则跨品类通用，不要默认写成玩具套图。仅当用户品类或参考图明确是玩具时，才规划儿童玩耍互动；厨具、百货、3C 等应规划对应真实消费使用场景。
7. 用户未提供的认证、尺寸、赠品、功能、配件数量一律不得编造。卖点可只填 1–3 条或留空；未指定绑定的张数由你根据参考图合理补充卖点与场景，但必须忠实于可见产品事实。
8. 第 1 张默认作为主图，除非用户另有说明。整套配色要统一且有撞色节奏，但每张排版不得雷同。
9. 每张 image_prompt 必须是完整、可直接送给图像模型的中文生图提示词：先复述绝对外观锁定指令，再写构图、画幅、场景、光线、人物互动（如有）、文案原文、排版位置以及文案用色分配。文案要写进 prompt，由图像模型原生排版，不要要求后期叠字。
10. 标题、副标题使用生动、简短的中文，主副标题之间要有呼吸感，不要把两句话挤成一块。
11. 若用户指定了文案主色，必须以该主色（名称 + hex）作为整套图的核心文案主色；由你结合参考图中商品自身配色与场景风格，自主挑选 1 个鲜明、高对比、不与商品本身冲突的撞色作为点缀色（例如选蓝配红或亮橙、选黑配亮黄或炽橙）。在 design_direction.palette 中写明「主色 + 你自动搭配的撞色与原因」。主标题主体优先用用户指定主色，核心数字、重点卖点词、小标签/角标或副标题点缀使用该撞色，形成鲜明电商撞色层次但不花哨。若某张是暗底场景导致深主色对比不足，须自动适度提亮、加轻底衬/微描边，或由亮撞色/白字承托，确保清晰可读，且绝对不改变产品外观。每张 image_prompt 都要写清具体中文文案的用色分配。
12. 若用户未指定主色，可按商品和场景自由搭配一组统一的主色与撞色，并在 palette 中说明。
13. 按用户给出的默认画幅（可以是常用比例，也可以是自定义比例或自定义像素）规划构图。images[].aspect_ratio 填写该画幅，自定义像素写成 800x1000 这种形式，自定义比例写成 4:5。不要擅自改成未要求的比例。

JSON 结构必须是：
{
  "design_direction": {
    "palette": "主色与撞色简述（若用户指定主色，必须写明主色 + AI 自动搭配的撞色与原因）",
    "contrast": "对比与节奏简述",
    "style_summary": "整套设计方向一句话"
  },
  "images": [
    {
      "index": 1,
      "role": "hero | usage | selling_point | detail | close | bundle",
      "aspect_ratio": "1:1 或 4:5 或 800x1000",
      "title": "主标题",
      "subtitle": "副标题",
      "scene_summary": "场景摘要",
      "layout_summary": "排版摘要",
      "image_prompt": "完整生图提示词"
    }
  ]
}

images 数组长度必须严格等于用户要求的张数；index 从 1 连续编号。`

export function buildColorInstruction(color?: TextPrimaryColor | null): string {
  if (!color) {
    return '文案配色：用户选择「AI 自动」，请根据商品参考图自行确定一组统一的主色与撞色，并在 palette 中说明。'
  }
  return [
    `文案主色（用户指定）：${describeTextPrimaryColor(color)}。`,
    '请结合参考图中商品自身配色与场景风格，自主挑选 1 个鲜明、高对比、不与商品本身冲突的撞色作为点缀色，不要让用户再选第二色。',
    '主标题主体优先使用该主色；核心数字、重点卖点词、小标签/角标或副标题点缀使用你搭配的撞色。',
    '暗底或低对比场景须自动提亮、加轻底衬/微描边，或改用亮撞色/白字承托，保证文字清晰可读，且绝对不改变产品外观。',
    '请在 design_direction.palette 写明「主色 + 自动搭配的撞色与原因」，并在每张 image_prompt 中写清具体文案用色分配。',
  ].join('')
}

export function buildPlanUserPrompt(input: {
  productName: string
  category: string
  count: number
  frameSpec: FrameSpec
  textPrimaryColor?: TextPrimaryColor | null
  sellingPoints: SellingPoint[]
  extraNotes: string
  assets: Pick<ProductAsset, 'name' | 'width' | 'height'>[]
}): string {
  const points = input.sellingPoints
    .map((p, i) => {
      const text = p.text.trim()
      if (!text) return null
      const bind = typeof p.bindIndex === 'number' && p.bindIndex >= 1
        ? `（绑定第 ${p.bindIndex} 张）`
        : '（未绑定，可由你合理安排）'
      return `${i + 1}. ${text}${bind}`
    })
    .filter(Boolean)

  const assetLines = input.assets.map((asset, i) => {
    const size = asset.width && asset.height ? `${asset.width}×${asset.height}px` : '尺寸未知'
    return `${i + 1}. ${asset.name || '参考图'}（${size}）`
  })

  return [
    APPEARANCE_LOCK,
    '',
    `商品名称：${input.productName.trim() || '未填写'}`,
    `品类：${input.category.trim() || '未填写，请根据参考图判断，不要臆造具体规格'}`,
    `输出张数：${input.count}`,
    `默认画幅：${describeFrame(input.frameSpec)}。规划后允许为单张调整，但本次请先按该画幅规划构图，images[].aspect_ratio 写回同样的画幅规格。`,
    framePromptHint(input.frameSpec),
    buildColorInstruction(input.textPrimaryColor),
    `参考图数量：${input.assets.length}`,
    assetLines.length ? `参考图：\n${assetLines.join('\n')}` : '参考图：无（这不合法，应被前端拦截）',
    '',
    points.length ? `用户卖点：\n${points.join('\n')}` : '用户卖点：未填写，请只根据参考图可见事实补充，禁止编造认证/尺寸/赠品/未出现的功能。',
    '',
    input.extraNotes.trim() ? `补充要求：\n${input.extraNotes.trim()}` : '补充要求：无',
    '',
    `请输出恰好 ${input.count} 张图的 JSON 策划方案。`,
  ].join('\n')
}

export function assembleImagePrompt(card: {
  imagePrompt: string
  title?: string
  subtitle?: string
  role?: string
  frameSpec?: FrameSpec
  textPrimaryColor?: TextPrimaryColor | null
}): string {
  const prompt = card.imagePrompt.trim()
  const hasLock = prompt.includes('绝对指令') && prompt.includes('不允许改变产品外观')
  const parts: string[] = []
  if (!hasLock) parts.push(APPEARANCE_LOCK)
  parts.push(prompt)
  if (card.role === 'hero' && !prompt.includes('主图规则')) parts.push(HERO_RULE)
  if (card.role && card.role !== 'hero' && !prompt.includes('避免整张纯白底')) parts.push(COLORFUL_SCENE_RULE)
  if (card.role === 'usage' && !prompt.includes('禁止把场景硬切一半')) parts.push(COMPOSITION_RULE)
  if (card.frameSpec) {
    const hint = framePromptHint(card.frameSpec)
    const ratio = describeFrame(card.frameSpec)
    const already = prompt.includes('画幅要求') || prompt.includes(ratio) || (card.frameSpec.inputMode === 'pixels' && prompt.includes(`${card.frameSpec.width}×${card.frameSpec.height}`))
    if (!already) parts.push(hint)
  }
  if (card.textPrimaryColor) {
    const hex = card.textPrimaryColor.hex.toUpperCase()
    const already = prompt.includes(hex) || prompt.includes(card.textPrimaryColor.name)
    if (!already) {
      parts.push(`文案配色约束：主标题主体使用用户指定主色「${card.textPrimaryColor.name}」${hex}；请按商品参考图自动搭配 1 个鲜明、高对比且不与商品本身冲突的撞色，用于核心数字、重点卖点词、小标签/角标或副标题点缀。暗底场景须自动提亮或用亮撞色/白字/轻底衬保证可读，且绝对不改变产品外观。`)
    }
  }
  return parts.filter(Boolean).join('\n')
}

export function promptContainsAppearanceLock(text: string): boolean {
  return text.includes('绝对指令') && text.includes('不允许改变产品外观')
}
