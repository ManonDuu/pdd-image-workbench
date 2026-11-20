import { getImageDimensions } from '../lib/db'
import { submitTask, useStore, waitForTaskSettled } from '../store'
import { frameFromPreset } from './frameSpec'
import { collectInputImages } from './generationInputs'
import { buildImageTaskParams } from './imageParams'
import { failedCardPatch, resolveOutboundImagePrompt, succeededCardPatch } from './promptSync'
import { assembleImagePrompt } from './prompts'
import type { PddSession } from './types'
import { usePddStore } from './store'

function snapshotGenerationSettings() {
  const { settings, params } = useStore.getState()
  return {
    model: settings.model,
    apiMode: settings.apiMode,
    params,
  }
}

function applyGenerationSettings(imageModel?: string) {
  const store = useStore.getState()
  if (imageModel) {
    store.setSettings({ model: imageModel, apiMode: 'images' })
  }
}

function restoreGenerationSettings(snapshot: ReturnType<typeof snapshotGenerationSettings>) {
  const store = useStore.getState()
  store.setSettings({ model: snapshot.model, apiMode: snapshot.apiMode })
  store.setParams(snapshot.params)
}


export function resolveCardGenerationInput(session: PddSession, cardId: string) {
  const card = session.cards.find((item) => item.id === cardId)
  if (!card) throw new Error('找不到分镜卡片')
  const frameSpec = card.frameSpec || frameFromPreset(card.aspectRatio)
  const imagePrompt = resolveOutboundImagePrompt(card)
  const prompt = assembleImagePrompt({
    ...card,
    imagePrompt,
    frameSpec,
    textPrimaryColor: session.textPrimaryColor ?? null,
  })
  return { card, frameSpec, prompt, imagePrompt }
}

export async function generateCard(cardId: string, options?: { imageModel?: string }): Promise<void> {
  const initial = usePddStore.getState()
  const existing = initial.session.cards.find((item) => item.id === cardId)
  if (!existing) throw new Error('找不到分镜卡片')
  if (existing.status === 'generating') return

  const inputImages = await collectInputImages(initial.session.assets)
  if (!inputImages.length) throw new Error('缺少商品参考图，无法生图')

  // 参考图准备可能耗时，提交前重新读取最新卡片，避免用到点击前的旧字段或旧 Prompt。
  const pdd = usePddStore.getState()
  const resolved = resolveCardGenerationInput(pdd.session, cardId)
  const { frameSpec, prompt } = resolved
  if (resolved.imagePrompt !== resolved.card.imagePrompt) {
    pdd.patchCard(cardId, { imagePrompt: resolved.imagePrompt, lastStructuredEditAt: resolved.card.lastStructuredEditAt ?? Date.now() })
  }
  pdd.patchCard(cardId, { status: 'generating', error: null })

  const snapshot = snapshotGenerationSettings()
  let taskId: string | undefined
  try {
    applyGenerationSettings(options?.imageModel || pdd.session.imageModel)
    useStore.getState().setParams(buildImageTaskParams(useStore.getState().params, frameSpec))
    const ids = await submitTask({
      input: { prompts: [prompt], inputImages },
    })
    taskId = ids[0]
    if (!taskId) {
      throw new Error('任务没有启动（可能被校验拦截）。请检查设置后手动重试，系统不会自动重试。')
    }
    pdd.patchCard(cardId, { taskId })
    await waitForTaskSettled(taskId, () => false)
    const task = useStore.getState().tasks.find((item) => item.id === taskId)
    if (!task) throw new Error('任务记录丢失')
    if (task.status === 'error') {
      throw new Error(task.error || '生图失败')
    }
    const resultImageId = task.outputImages?.[0]
    if (!resultImageId) throw new Error('生图完成但没有返回图片')
    const dims = await getImageDimensions(resultImageId)
    const actual = task.actualParamsByImage?.[resultImageId] ?? task.actualParams
    pdd.patchCard(cardId, succeededCardPatch({
      taskId,
      resultImageId,
      width: dims?.width,
      height: dims?.height,
      quality: actual?.quality ?? null,
      sizeLabel: actual?.size ?? null,
    }))
  } catch (err) {
    const latestCard = usePddStore.getState().session.cards.find((item) => item.id === cardId)
    pdd.patchCard(cardId, failedCardPatch(latestCard ?? existing, err instanceof Error ? err.message : String(err), taskId))
    throw err
  } finally {
    restoreGenerationSettings(snapshot)
  }
}

export async function runQueue(cardIds: string[], imageModel?: string): Promise<void> {
  const pdd = usePddStore.getState()
  if (pdd.queuePhase === 'running' || pdd.queuePhase === 'planning') return
  pdd.setQueue({ phase: 'running', cursor: 0, stopped: false, paused: false, activeCardId: null })

  for (let i = 0; i < cardIds.length; i += 1) {
    const state = usePddStore.getState()
    if (state.queueStopped) {
      state.setQueue({ phase: 'stopped', activeCardId: null })
      return
    }
    while (usePddStore.getState().queuePaused && !usePddStore.getState().queueStopped) {
      usePddStore.getState().setQueue({ phase: 'paused' })
      await new Promise((resolve) => window.setTimeout(resolve, 200))
    }
    const latest = usePddStore.getState()
    if (latest.queueStopped) {
      latest.setQueue({ phase: 'stopped', activeCardId: null })
      return
    }
    const cardId = cardIds[i]
    latest.setQueue({ phase: 'running', cursor: i, activeCardId: cardId })
    latest.patchCard(cardId, { status: 'queued', error: null })
    try {
      await generateCard(cardId, { imageModel })
    } catch {
      // 单张失败标红后停止队列，不自动重试。
      usePddStore.getState().setQueue({ phase: 'stopped', activeCardId: null })
      return
    }
  }
  usePddStore.getState().setQueue({ phase: 'idle', activeCardId: null, paused: false, stopped: false })
}

export function pauseQueue() {
  const state = usePddStore.getState()
  if (state.queuePhase === 'running') state.setQueue({ paused: true, phase: 'paused' })
}

export function resumeQueue() {
  const state = usePddStore.getState()
  if (state.queuePhase === 'paused') state.setQueue({ paused: false, phase: 'running' })
}

export function stopQueue() {
  usePddStore.getState().setQueue({ stopped: true, paused: false, phase: 'stopped', activeCardId: null })
}
