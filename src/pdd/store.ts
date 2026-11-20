import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { hydrateAssets } from './assets'
import { parsePlanResponse } from './planSchema'
import { requestPlan } from './api'
import type { TextPrimaryColor } from './colors'
import { DEFAULT_FRAME, frameFromPreset, normalizeStoredFrame } from './frameSpec'
import type { AspectRatio, DetectedModels, FrameSpec, PddSession, ProductAsset, QueuePhase, SellingPoint, StoryboardCard } from './types'
import { applyCardPatch } from './promptSync'

const MAX_COUNT = 12

export interface PddState {
  session: PddSession
  planningModel: string
  imageModel: string
  detected: DetectedModels | null
  queuePhase: QueuePhase
  queueCursor: number
  queuePaused: boolean
  queueStopped: boolean
  activeCardId: string | null
  lightbox: { cardId: string } | null
  setProductName: (value: string) => void
  setCategory: (value: string) => void
  setCount: (value: number) => void
  setGlobalRatio: (value: AspectRatio) => void
  setGlobalFrameSpec: (value: FrameSpec) => void
  setTextPrimaryColor: (value: TextPrimaryColor | null) => void
  setExtraNotes: (value: string) => void
  setSellingPoints: (value: SellingPoint[]) => void
  setAssets: (value: ProductAsset[], options?: { clearPlanningError?: boolean }) => void
  setModels: (planning?: string, image?: string) => void
  setDetected: (value: DetectedModels | null) => void
  patchCard: (id: string, patch: Partial<StoryboardCard>) => void
  removeCard: (id: string) => void
  setQueue: (patch: Partial<Pick<PddState, 'queuePhase' | 'queueCursor' | 'queuePaused' | 'queueStopped' | 'activeCardId'>> & { phase?: QueuePhase; cursor?: number; paused?: boolean; stopped?: boolean }) => void
  setLightbox: (cardId: string | null) => void
  applyPlan: (cards: Omit<StoryboardCard, 'id' | 'status'>[], design: PddSession['designDirection'], models?: { planning?: string; image?: string }) => void
  setPlanningError: (error: string | null) => void
  resetResults: () => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `pdd-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createSession(): PddSession {
  return {
    id: newId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    productName: '',
    category: '',
    count: 6,
    globalRatio: '1:1',
    globalFrameSpec: DEFAULT_FRAME,
    textPrimaryColor: null,
    sellingPoints: [
      { id: newId(), text: '', bindIndex: null },
    ],
    extraNotes: '',
    assets: [],
    designDirection: null,
    cards: [],
    planningError: null,
  }
}

export const usePddStore = create<PddState>()(
  persist(
    (set) => ({
      session: createSession(),
      planningModel: '',
      imageModel: '',
      detected: null,
      queuePhase: 'idle',
      queueCursor: 0,
      queuePaused: false,
      queueStopped: false,
      activeCardId: null,
      lightbox: null,
      setProductName: (productName) => set((s) => ({ session: { ...s.session, productName, updatedAt: Date.now() } })),
      setCategory: (category) => set((s) => ({ session: { ...s.session, category, updatedAt: Date.now() } })),
      setCount: (value) => {
        const count = Math.min(MAX_COUNT, Math.max(1, Math.round(value) || 1))
        set((s) => ({ session: { ...s.session, count, updatedAt: Date.now() } }))
      },
      setGlobalRatio: (globalRatio) => set((s) => ({ session: { ...s.session, globalRatio, globalFrameSpec: frameFromPreset(globalRatio), updatedAt: Date.now() } })),
      setGlobalFrameSpec: (globalFrameSpec) => set((s) => ({
        session: {
          ...s.session,
          globalFrameSpec,
          globalRatio: globalFrameSpec.inputMode === 'preset' && globalFrameSpec.preset ? globalFrameSpec.preset : s.session.globalRatio,
          updatedAt: Date.now(),
        },
      })),
      setTextPrimaryColor: (textPrimaryColor) => set((s) => ({ session: { ...s.session, textPrimaryColor, updatedAt: Date.now() } })),
      setExtraNotes: (extraNotes) => set((s) => ({ session: { ...s.session, extraNotes, updatedAt: Date.now() } })),
      setSellingPoints: (sellingPoints) => set((s) => ({ session: { ...s.session, sellingPoints, updatedAt: Date.now() } })),
      setAssets: (assets, options) => set((s) => ({
        session: {
          ...s.session,
          assets,
          planningError: options?.clearPlanningError ? null : s.session.planningError,
          updatedAt: Date.now(),
        },
      })),
      setModels: (planning, image) => set((s) => ({
        planningModel: planning ?? s.planningModel,
        imageModel: image ?? s.imageModel,
        session: { ...s.session, planningModel: planning ?? s.planningModel, imageModel: image ?? s.imageModel, updatedAt: Date.now() },
      })),
      setDetected: (detected) => set({ detected }),
      patchCard: (id, patch) => set((s) => ({
        session: {
          ...s.session,
          updatedAt: Date.now(),
          cards: s.session.cards.map((card) => (card.id === id ? applyCardPatch(card, patch) : card)),
        },
      })),
      removeCard: (id) => set((s) => ({
        session: {
          ...s.session,
          updatedAt: Date.now(),
          cards: s.session.cards.filter((card) => card.id !== id).map((card, index) => ({ ...card, index: index + 1 })),
        },
      })),
      setQueue: (patch) => set((s) => ({
        queuePhase: patch.phase ?? patch.queuePhase ?? s.queuePhase,
        queueCursor: patch.cursor ?? patch.queueCursor ?? s.queueCursor,
        queuePaused: patch.paused ?? patch.queuePaused ?? s.queuePaused,
        queueStopped: patch.stopped ?? patch.queueStopped ?? s.queueStopped,
        activeCardId: patch.activeCardId === undefined ? s.activeCardId : patch.activeCardId,
      })),
      setLightbox: (cardId) => set({ lightbox: cardId ? { cardId } : null }),
      applyPlan: (cards, designDirection, models) => set((s) => ({
        planningModel: models?.planning ?? s.planningModel,
        imageModel: models?.image ?? s.imageModel,
        queuePhase: 'idle',
        queuePaused: false,
        queueStopped: false,
        activeCardId: null,
        session: {
          ...s.session,
          updatedAt: Date.now(),
          designDirection,
          planningError: null,
          planningModel: models?.planning ?? s.planningModel,
          imageModel: models?.image ?? s.imageModel,
          cards: cards.map((card) => ({
            ...card,
            id: newId(),
            status: 'idle' as const,
            error: null,
            taskId: null,
            resultImageId: null,
          })),
        },
      })),
      setPlanningError: (planningError) => set((s) => ({ session: { ...s.session, planningError, updatedAt: Date.now() } })),
      resetResults: () => set((s) => ({
        session: {
          ...s.session,
          cards: s.session.cards.map((card) => ({
            ...card,
            status: 'idle' as const,
            error: null,
            taskId: null,
            resultImageId: null,
            resultWidth: undefined,
            resultHeight: undefined,
            generatedAt: undefined,
          })),
        },
      })),
    }),
    {
      name: 'pdd-workbench-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        planningModel: state.planningModel,
        imageModel: state.imageModel,
        session: {
          ...state.session,
          assets: state.session.assets.map(({ dataUrl: _d, thumbnailDataUrl: _t, ...rest }) => rest),
        },
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.setQueue({ phase: 'idle', paused: false, stopped: false, activeCardId: null })
        const session = state.session
        const globalFrameSpec = normalizeStoredFrame(session.globalFrameSpec, frameFromPreset(session.globalRatio || '1:1'))
        const cards = session.cards.map((card) => ({
          ...card,
          frameSpec: normalizeStoredFrame(card.frameSpec, frameFromPreset(card.aspectRatio || session.globalRatio || '1:1')),
        }))
        if (session.textPrimaryColor === undefined) {
          usePddStore.setState({ session: { ...session, globalFrameSpec, textPrimaryColor: null, cards } })
        } else {
          usePddStore.setState({ session: { ...session, globalFrameSpec, cards } })
        }
        const assets = usePddStore.getState().session.assets
        if (assets.length) {
          void hydrateAssets(assets).then((hydrated) => {
            usePddStore.getState().setAssets(hydrated)
          }).catch(() => {
            /* keep metadata if blobs missing */
          })
        }
      },
    },
  ),
)

export function makeSellingPoint(text = '', bindIndex: number | null = null): SellingPoint {
  return { id: newId(), text, bindIndex }
}

export async function runPlanning(): Promise<void> {
  const state = usePddStore.getState()
  if (state.queuePhase === 'planning' || state.queuePhase === 'running') return
  if (!state.session.assets.length) {
    state.setPlanningError('请至少上传 1 张商品参考图')
    return
  }
  if (!state.planningModel) {
    state.setPlanningError('请先点击「检测连接 / 获取模型」，并选择规划模型')
    return
  }
  state.setQueue({ phase: 'planning', paused: false, stopped: false })
  state.setPlanningError(null)
  try {
    const result = await requestPlan({
      planningModel: state.planningModel,
      productName: state.session.productName,
      category: state.session.category,
      count: state.session.count,
      frameSpec: state.session.globalFrameSpec || frameFromPreset(state.session.globalRatio || '1:1'),
      textPrimaryColor: state.session.textPrimaryColor ?? null,
      sellingPoints: state.session.sellingPoints,
      extraNotes: state.session.extraNotes,
      assets: state.session.assets,
    })
    if (!result.ok || !result.text) {
      state.setPlanningError(result.error || '策划失败')
      state.setQueue({ phase: 'idle' })
      return
    }
    const parsed = parsePlanResponse(
      result.text,
      state.session.count,
      state.session.globalFrameSpec || frameFromPreset(state.session.globalRatio || '1:1'),
      state.session.textPrimaryColor ?? null,
    )
    if (!parsed.ok || !parsed.plan) {
      state.setPlanningError(parsed.error || '策划结果无法解析')
      state.setQueue({ phase: 'idle' })
      return
    }
    state.applyPlan(parsed.plan.cards, parsed.plan.designDirection, { planning: state.planningModel, image: state.imageModel })
    state.setQueue({ phase: 'idle' })
  } catch (err) {
    state.setPlanningError(err instanceof Error ? err.message : String(err))
    state.setQueue({ phase: 'idle' })
  }
}

export { parsePlanResponse }
