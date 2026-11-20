export const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const
export type AspectRatio = (typeof ASPECT_RATIOS)[number]

export type FrameInputMode = 'preset' | 'pixels' | 'ratio'

/** 全局或单张画幅。旧会话只有 preset 比例时，按 aspectRatio 回退。 */
export interface FrameSpec {
  inputMode: FrameInputMode
  preset?: AspectRatio
  width: number
  height: number
}

export const IMAGE_ROLES = ['hero', 'usage', 'selling_point', 'detail', 'close', 'bundle'] as const
export type ImageRole = (typeof IMAGE_ROLES)[number]

export const ROLE_LABELS: Record<ImageRole, string> = {
  hero: '主图',
  usage: '使用场景',
  selling_point: '核心卖点',
  detail: '细节特写',
  close: '收束图',
  bundle: '套装展示',
}

export interface SellingPoint {
  id: string
  text: string
  bindIndex?: number | null
}

export interface ProductAsset {
  id: string
  imageId: string
  name: string
  width?: number
  height?: number
  dataUrl?: string
  thumbnailDataUrl?: string
}

export interface DesignDirection {
  palette: string
  contrast: string
  styleSummary: string
}

export type CardStatus = 'idle' | 'queued' | 'generating' | 'done' | 'error'

export interface StoryboardCard {
  id: string
  index: number
  role: ImageRole
  aspectRatio: AspectRatio
  frameSpec: FrameSpec
  title: string
  subtitle: string
  sceneSummary: string
  layoutSummary: string
  imagePrompt: string
  /** 最近一次改标题/副标题/场景/排版的时间，用于与最终 Prompt 手改比优先级。 */
  lastStructuredEditAt?: number
  /** 最近一次直接手改最终 Prompt 的时间。 */
  lastPromptEditAt?: number
  status: CardStatus
  error?: string | null
  taskId?: string | null
  resultImageId?: string | null
  resultWidth?: number
  resultHeight?: number
  resultQuality?: string | null
  resultSizeLabel?: string | null
  generatedAt?: number
}

export type QueuePhase = 'idle' | 'planning' | 'running' | 'paused' | 'stopped'

export interface DetectedModels {
  checkedAt: number
  allIds: string[]
  planningIds: string[]
  imageIds: string[]
  recommendedPlanning?: string
  recommendedImage?: string
  error?: string | null
}

export interface PddSession {
  id: string
  createdAt: number
  updatedAt: number
  productName: string
  category: string
  count: number
  globalRatio: AspectRatio
  globalFrameSpec: FrameSpec
  /** null / 缺省 = AI 自动配色，兼容旧会话。 */
  textPrimaryColor?: { name: string; hex: string } | null
  sellingPoints: SellingPoint[]
  extraNotes: string
  assets: ProductAsset[]
  designDirection: DesignDirection | null
  cards: StoryboardCard[]
  planningError: string | null
  planningModel?: string
  imageModel?: string
}

export const DEFAULT_DESIGN_DIRECTION: DesignDirection = {
  palette: '',
  contrast: '',
  styleSummary: '',
}
