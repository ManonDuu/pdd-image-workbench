import { getActiveApiProfile } from '../lib/apiProfiles'
import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from '../lib/devProxy'
import { useStore } from '../store'
import { classifyModels, type ModelPick } from './models'
import { PLAN_SYSTEM_PROMPT, buildPlanUserPrompt } from './prompts'
import type { TextPrimaryColor } from './colors'
import { prepareReferenceAssets, ReferenceImageError } from './referenceImage'
import type { FrameSpec, ProductAsset, SellingPoint } from './types'

const PLAN_TIMEOUT_MS = 180_000

export interface DetectResult extends ModelPick {
  checkedAt: number
  baseUrlHost: string
  ok: boolean
  error?: string
  status?: number
}

export interface PlanRequest {
  planningModel: string
  productName: string
  category: string
  count: number
  frameSpec: FrameSpec
  textPrimaryColor?: TextPrimaryColor | null
  sellingPoints: SellingPoint[]
  extraNotes: string
  assets: ProductAsset[]
}

export interface PlanCallResult {
  ok: boolean
  text?: string
  error?: string
  status?: number
  model?: string
}

function getProfile() {
  return getActiveApiProfile(useStore.getState().settings)
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function describeHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || baseUrl
  } catch {
    return baseUrl || '未填写'
  }
}

export async function detectConnection(): Promise<DetectResult> {
  const profile = getProfile()
  const baseUrl = profile.baseUrl?.trim() || ''
  const checkedAt = Date.now()
  if (!baseUrl) {
    return { ok: false, checkedAt, baseUrlHost: '', allIds: [], planningIds: [], imageIds: [], error: '请先在设置中填写 Base URL（本机 Cockpit 一般为 http://127.0.0.1:62037/v1）' }
  }
  if (!profile.apiKey?.trim()) {
    return { ok: false, checkedAt, baseUrlHost: describeHost(baseUrl), allIds: [], planningIds: [], imageIds: [], error: '请先在设置中填写本机 API Key（仅保存在本机浏览器，不会写入项目文件）' }
  }
  const proxy = readClientDevProxyConfig()
  const url = buildApiUrl(baseUrl, 'models', proxy, shouldUseApiProxy(profile.apiProxy, proxy))
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${profile.apiKey}` },
    })
    if (!response.ok) {
      return {
        ok: false,
        checkedAt,
        baseUrlHost: describeHost(baseUrl),
        allIds: [],
        planningIds: [],
        imageIds: [],
        status: response.status,
        error: `获取模型失败：HTTP ${response.status}`,
      }
    }
    const payload = await response.json()
    const pick = classifyModels(payload)
    if (!pick.allIds.length) {
      return { ok: false, checkedAt, baseUrlHost: describeHost(baseUrl), ...pick, error: '连接成功，但模型目录为空' }
    }
    return { ok: true, checkedAt, baseUrlHost: describeHost(baseUrl), ...pick }
  } catch (err) {
    return {
      ok: false,
      checkedAt,
      baseUrlHost: describeHost(baseUrl),
      allIds: [],
      planningIds: [],
      imageIds: [],
      error: `连接失败：${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

function collectMessageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') {
        const rec = part as Record<string, unknown>
        if (typeof rec.text === 'string') return rec.text
        if (typeof rec.content === 'string') return rec.content
      }
      return ''
    }).join('')
  }
  if (content && typeof content === 'object' && 'text' in content) {
    const text = (content as { text?: unknown }).text
    return typeof text === 'string' ? text : ''
  }
  return ''
}

export async function requestPlan(input: PlanRequest): Promise<PlanCallResult> {
  const profile = getProfile()
  if (!input.planningModel.trim()) {
    return { ok: false, error: '请先检测连接并选择规划模型' }
  }
  if (!profile.baseUrl?.trim()) {
    return { ok: false, error: '请先在设置中填写 Base URL' }
  }
  if (!profile.apiKey?.trim()) {
    return { ok: false, error: '请先在设置中填写本机 API Key' }
  }
  let readyImages
  try {
    readyImages = await prepareReferenceAssets(input.assets)
  } catch (error) {
    const message = error instanceof ReferenceImageError || error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
  if (!readyImages.length) {
    return { ok: false, error: '缺少可发送的商品参考图' }
  }

  const userText = buildPlanUserPrompt(input)
  const content: unknown[] = [
    { type: 'text', text: userText },
    ...readyImages.map((image) => ({
      type: 'image_url',
      image_url: { url: image.dataUrl },
    })),
  ]

  const proxy = readClientDevProxyConfig()
  const url = buildApiUrl(profile.baseUrl, 'chat/completions', proxy, shouldUseApiProxy(profile.apiProxy, proxy))
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(profile.apiKey),
      signal: controller.signal,
      body: JSON.stringify({
        model: input.planningModel,
        temperature: 0.7,
        messages: [
          { role: 'system', content: PLAN_SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }),
    })
    if (!response.ok) {
      let detail = ''
      try {
        const failed = await response.json()
        const msg = failed?.error?.message || failed?.message
        if (typeof msg === 'string') detail = `：${msg}`
      } catch {
        /* ignore body */
      }
      return { ok: false, status: response.status, model: input.planningModel, error: `策划失败：HTTP ${response.status}${detail}` }
    }
    const payload = await response.json()
    const choice = payload?.choices?.[0]?.message?.content
    const text = collectMessageText(choice).trim()
    if (!text) {
      return { ok: false, model: input.planningModel, error: '策划接口没有返回文本内容' }
    }
    return { ok: true, text, model: input.planningModel }
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError'
    return {
      ok: false,
      model: input.planningModel,
      error: aborted ? '策划超时，请稍后重试（不会自动重试）' : `策划失败：${err instanceof Error ? err.message : String(err)}`,
    }
  } finally {
    window.clearTimeout(timer)
  }
}
