import { ROLE_LABELS, type FrameSpec, type ImageRole, type StoryboardCard as Card } from './types'
import { customPixelTarget, describeFrame, frameFromPreset } from './frameSpec'
import { formatPixelSize } from './imageParams'
import FrameSpecPicker from './FrameSpecPicker'

interface Props {
  card: Card
  previewUrl?: string
  busy: boolean
  onChange: (patch: Partial<Card>) => void
  onGenerate: () => void
  onRemove: () => void
  onPreview: () => void
  onDownload: () => void
  onDownloadCustom?: (width: number, height: number) => void
}

const ROLES = Object.keys(ROLE_LABELS) as ImageRole[]

export default function StoryboardCard({ card, previewUrl, busy, onChange, onGenerate, onRemove, onPreview, onDownload, onDownloadCustom }: Props) {
  const statusLabel = {
    idle: '未生成',
    queued: '排队中',
    generating: '生成中',
    done: '已完成',
    error: '失败',
  }[card.status]
  const frame = card.frameSpec || frameFromPreset(card.aspectRatio)
  const target = customPixelTarget(frame)
  const actual = formatPixelSize(card.resultWidth, card.resultHeight)
  const mismatch = Boolean(target && card.resultWidth && card.resultHeight && (target.width !== card.resultWidth || target.height !== card.resultHeight))

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-gray-500">第 {card.index} 张 · {statusLabel}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
              value={card.role}
              onChange={(e) => onChange({ role: e.target.value as ImageRole })}
            >
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </div>
          <div className="mt-2">
            <FrameSpecPicker
              compact
              value={frame}
              onChange={(next: FrameSpec) => onChange({ frameSpec: next, aspectRatio: next.preset || card.aspectRatio })}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={onGenerate} className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {card.status === 'done' ? '重新生成' : '生成'}
          </button>
          <button type="button" disabled={busy} onClick={onRemove} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700">删除</button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <label className="block text-xs text-gray-500">主标题
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={card.title} onChange={(e) => onChange({ title: e.target.value })} />
          </label>
          <label className="block text-xs text-gray-500">副标题
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={card.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
          </label>
          <label className="block text-xs text-gray-500">场景摘要
            <textarea rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={card.sceneSummary} onChange={(e) => onChange({ sceneSummary: e.target.value })} />
          </label>
          <label className="block text-xs text-gray-500">排版摘要
            <textarea rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={card.layoutSummary} onChange={(e) => onChange({ layoutSummary: e.target.value })} />
          </label>
          <details className="rounded-lg border border-dashed border-gray-200 p-3 dark:border-gray-700">
            <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-300">最终生图 Prompt</summary>
            <p className="mt-2 text-xs leading-5 text-gray-500">改上方标题、副标题、场景或排版后，会自动同步到这里再发送。若你直接改了这段最终 Prompt，则以你改过的全文为准。</p>
            <textarea rows={8} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={card.imagePrompt} onChange={(e) => onChange({ imagePrompt: e.target.value })} />
          </details>
          {card.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{card.error}</p> : null}
        </div>
        <div className="space-y-2">
          <button type="button" onClick={onPreview} className="block w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800" disabled={!previewUrl}>
            {previewUrl ? (
              <img src={previewUrl} alt={`第 ${card.index} 张预览`} className="h-48 w-full object-contain" />
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-gray-400">尚未生成</div>
            )}
          </button>
          <div className="text-xs text-gray-500">
            {mismatch && target
              ? `目标 ${target.width}×${target.height} · 模型实际返回 ${actual}`
              : actual ? `实际解码 ${actual}` : '实际像素待生成后显示'}
            {card.resultQuality ? ` · 质量 ${card.resultQuality}` : ''}
            {card.resultSizeLabel ? ` · 接口尺寸 ${card.resultSizeLabel}` : ''}
          </div>
          {card.resultImageId ? (
            <button type="button" onClick={onDownload} className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700">下载原图 PNG</button>
          ) : null}
          {card.resultImageId && target && onDownloadCustom ? (
            <button type="button" onClick={() => onDownloadCustom(target.width, target.height)} className="w-full rounded-lg border border-orange-200 px-3 py-1.5 text-sm text-orange-700 dark:border-orange-800 dark:text-orange-300">
              按自定义尺寸导出 ({target.width}×{target.height})
            </button>
          ) : null}
          {target && mismatch ? <p className="text-[11px] text-gray-400">该导出为客户端按目标尺寸居中 cover 缩放裁切，不会把画面拉扁拉长。</p> : null}
          <div className="text-[11px] text-gray-400">画幅：{describeFrame(frame)}</div>
        </div>
      </div>
    </article>
  )
}
