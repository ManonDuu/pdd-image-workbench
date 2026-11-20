import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { detectConnection } from './api'
import { importProductFiles, loadImageDataUrl } from './assets'
import { downloadCustomSizePng, downloadOriginalPng, downloadSetZip } from './exportSet'
import { DEFAULT_FRAME, customPixelTarget } from './frameSpec'
import FrameSpecPicker from './FrameSpecPicker'
import TextPrimaryColorPicker from './TextPrimaryColorPicker'
import { generateCard, pauseQueue, resumeQueue, runQueue, stopQueue } from './generation'
import { formatPixelSize } from './imageParams'
import { InstallHelpContent, INSTALL_HELP_TITLE } from './InstallHelp'
import { makeSellingPoint, runPlanning, usePddStore } from './store'
import StoryboardCard from './StoryboardCard'
import { ROLE_LABELS } from './types'

export default function Workbench() {
  const session = usePddStore((s) => s.session)
  const planningModel = usePddStore((s) => s.planningModel)
  const imageModel = usePddStore((s) => s.imageModel)
  const detected = usePddStore((s) => s.detected)
  const queuePhase = usePddStore((s) => s.queuePhase)
  const queuePaused = usePddStore((s) => s.queuePaused)
  const lightbox = usePddStore((s) => s.lightbox)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const showToast = useStore((s) => s.showToast)

  const [customCount, setCustomCount] = useState(String(session.count))
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [resultUrls, setResultUrls] = useState<Record<string, string>>({})
  const [zipping, setZipping] = useState(false)
  const [zipCustomPixels, setZipCustomPixels] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const generatingLock = queuePhase === 'planning' || queuePhase === 'running' || queuePhase === 'paused'

  useEffect(() => { setCustomCount(String(session.count)) }, [session.count])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const next: Record<string, string> = {}
      for (const card of session.cards) {
        if (!card.resultImageId) continue
        const url = await loadImageDataUrl(card.resultImageId)
        if (url) next[card.resultImageId] = url
      }
      if (!cancelled) setResultUrls(next)
    }
    void load()
    return () => { cancelled = true }
  }, [session.cards])

  const onDetect = useCallback(async () => {
    setDetecting(true)
    try {
      const result = await detectConnection()
      usePddStore.getState().setDetected({
        checkedAt: result.checkedAt,
        allIds: result.allIds,
        planningIds: result.planningIds,
        imageIds: result.imageIds,
        recommendedPlanning: result.recommendedPlanning,
        recommendedImage: result.recommendedImage,
        error: result.error ?? null,
      })
      if (result.ok) {
        const nextPlanning = planningModel && result.planningIds.includes(planningModel)
          ? planningModel
          : result.recommendedPlanning || ''
        const nextImage = imageModel && result.imageIds.includes(imageModel)
          ? imageModel
          : result.recommendedImage || ''
        usePddStore.getState().setModels(nextPlanning, nextImage)
        showToast(`已连接 ${result.baseUrlHost}，识别到 ${result.allIds.length} 个模型`, 'success')
      } else {
        showToast(result.error || '检测连接失败', 'error')
      }
    } finally {
      setDetecting(false)
    }
  }, [imageModel, planningModel, showToast])

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (!files.length) return
    try {
      const imported = await importProductFiles(files)
      if (!imported.length) {
        showToast('没有识别到图片文件', 'error')
        return
      }
      usePddStore.getState().setAssets([...session.assets, ...imported], { clearPlanningError: true })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '上传失败', 'error')
    }
  }

  const onPlan = async () => {
    if (generatingLock) return
    await runPlanning()
    const error = usePddStore.getState().session.planningError
    if (error) showToast(error, 'error')
    else if (usePddStore.getState().session.cards.length) showToast('策划完成，可检查分镜后再生成', 'success')
  }

  const onGenerateAll = async () => {
    if (generatingLock) return
    const ids = usePddStore.getState().session.cards.map((card) => card.id)
    if (!ids.length) {
      showToast('请先完成 AI 规划', 'error')
      return
    }
    if (!usePddStore.getState().imageModel) {
      showToast('请先检测连接并选择生图模型', 'error')
      return
    }
    await runQueue(ids, usePddStore.getState().imageModel)
  }

  const doneCount = session.cards.filter((card) => card.status === 'done' && card.resultImageId).length
  const activeLightboxCard = session.cards.find((card) => card.id === lightbox?.cardId)
  const compareUrl = session.assets[0]?.dataUrl || session.assets[0]?.thumbnailDataUrl

  const detectedHint = useMemo(() => {
    if (detecting) return '正在检测连接…'
    if (!detected) return '尚未检测。点击按钮通过当前设置请求模型目录。'
    if (detected.error) return detected.error
    return `已识别规划模型 ${detected.planningIds.length} 个、生图模型 ${detected.imageIds.length} 个。`
  }, [detected, detecting])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-24">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">拼多多套图工作台</h1>
            <p className="mt-1 text-sm text-gray-500">上传商品图，填写张数、比例和卖点，由本机 Cockpit 反代完成策划与生图。密钥只留在本机浏览器。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowSettings(true)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">打开连接设置</button>
            <button type="button" onClick={() => setShowInstallHelp((v) => !v)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">安装与授权说明</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="text-xs text-gray-500">规划模型
            <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={planningModel} onChange={(e) => usePddStore.getState().setModels(e.target.value, imageModel)}>
              <option value="">{detected?.planningIds.length ? '请选择规划模型' : '请先检测连接'}</option>
              {(detected?.planningIds.length ? detected.planningIds : (planningModel ? [planningModel] : [])).map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">生图模型
            <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={imageModel} onChange={(e) => usePddStore.getState().setModels(planningModel, e.target.value)}>
              <option value="">{detected?.imageIds.length ? '请选择生图模型' : '请先检测连接'}</option>
              {(detected?.imageIds.length ? detected.imageIds : (imageModel ? [imageModel] : [])).map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <button type="button" disabled={detecting} onClick={() => void onDetect()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900">
            {detecting ? '检测中…' : '检测连接 / 获取模型'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">{detectedHint} 默认不会选择 gpt-image-2.6-sunburst。</p>
        {showInstallHelp ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
            <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{INSTALL_HELP_TITLE}</h2>
            <InstallHelpContent />
          </div>
        ) : null}
      </section>

      <section data-testid="pdd-input-panel" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-base font-semibold">套图输入</h2>
        <div
          className="mt-3 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600"
          onDragOver={(e) => { e.preventDefault() }}
          onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files) }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>拖拽或选择商品参考图，至少 1 张，可多选。</span>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-orange-500 px-3 py-1.5 text-white">上传图片</button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = '' }} />
          {session.assets.length ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {session.assets.map((asset) => (
                <figure key={asset.id} className="w-28">
                  <img src={asset.thumbnailDataUrl || asset.dataUrl} alt={asset.name} className="h-24 w-28 rounded-lg object-cover" />
                  <figcaption className="mt-1 truncate text-[11px] text-gray-500">{asset.name}</figcaption>
                  <div className="text-[11px] text-gray-400">{formatPixelSize(asset.width, asset.height) || '像素读取中'}</div>
                  <button type="button" className="text-[11px] text-red-500" onClick={() => usePddStore.getState().setAssets(session.assets.filter((item) => item.id !== asset.id), { clearPlanningError: true })}>移除</button>
                </figure>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-gray-500">商品名称（可选）
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={session.productName} onChange={(e) => usePddStore.getState().setProductName(e.target.value)} placeholder="例如：工程车套装 / 不粘煎锅" />
          </label>
          <label className="text-xs text-gray-500">品类（可选，跨类目通用）
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={session.category} onChange={(e) => usePddStore.getState().setCategory(e.target.value)} placeholder="玩具、厨具、百货、3C…" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">输出张数</span>
          {[3, 6, 9].map((count) => (
            <button type="button" key={count} onClick={() => usePddStore.getState().setCount(count)} className={`rounded-full px-3 py-1 text-sm ${session.count === count ? 'bg-orange-500 text-white' : 'border border-gray-200 dark:border-gray-700'}`}>{count}张</button>
          ))}
          <label className="ml-2 text-sm text-gray-600">自定义
            <input type="number" min={1} max={12} className="ml-2 w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" value={customCount} onChange={(e) => { setCustomCount(e.target.value); const n = Number(e.target.value); if (n >= 1 && n <= 12) usePddStore.getState().setCount(n) }} />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-sm text-gray-600">默认尺寸 / 比例</div>
          <FrameSpecPicker
            value={session.globalFrameSpec || DEFAULT_FRAME}
            onChange={(frame) => usePddStore.getState().setGlobalFrameSpec(frame)}
          />
          <span className="text-xs text-gray-400">规划完成后可在每张卡片单独修改。自定义像素会在导出时精确裁切到目标尺寸。</span>
        </div>

        <div className="mt-4">
          <TextPrimaryColorPicker
            value={session.textPrimaryColor ?? null}
            onChange={(color) => usePddStore.getState().setTextPrimaryColor(color)}
          />
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">卖点（可留空，未填张数由 AI 按产品图补充，不会编造未提供的认证/尺寸/赠品）</span>
            <button type="button" className="text-sm text-orange-600" onClick={() => usePddStore.getState().setSellingPoints([...session.sellingPoints, makeSellingPoint()])}>添加卖点</button>
          </div>
          {session.sellingPoints.map((point, index) => (
            <div key={point.id} className="flex flex-wrap gap-2">
              <input className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={point.text} placeholder={`卖点 ${index + 1}`} onChange={(e) => {
                const next = session.sellingPoints.map((item) => item.id === point.id ? { ...item, text: e.target.value } : item)
                usePddStore.getState().setSellingPoints(next)
              }} />
              <select className="rounded-lg border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={point.bindIndex ?? ''} onChange={(e) => {
                const bindIndex = e.target.value ? Number(e.target.value) : null
                const next = session.sellingPoints.map((item) => item.id === point.id ? { ...item, bindIndex } : item)
                usePddStore.getState().setSellingPoints(next)
              }}>
                <option value="">不绑定，由 AI 安排</option>
                {Array.from({ length: session.count }, (_, i) => <option key={i + 1} value={i + 1}>绑定第 {i + 1} 张</option>)}
              </select>
              <button type="button" className="text-sm text-gray-400" onClick={() => usePddStore.getState().setSellingPoints(session.sellingPoints.filter((item) => item.id !== point.id) || [])}>删除</button>
            </div>
          ))}
        </div>

        <label className="mt-4 block text-xs text-gray-500">补充要求（可选）
          <textarea rows={3} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" value={session.extraNotes} placeholder="风格倾向、目标人群、禁止事项等" onChange={(e) => usePddStore.getState().setExtraNotes(e.target.value)} />
        </label>

        <div className="mt-4">
          <button type="button" disabled={generatingLock} onClick={() => void onPlan()} className="rounded-xl bg-orange-500 px-5 py-2.5 font-medium text-white disabled:opacity-50">
            {queuePhase === 'planning' ? '正在策划…' : 'AI 规划整套方案'}
          </button>
        </div>
        {session.planningError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{session.planningError}</p> : null}
      </section>

      {session.cards.length ? (
        <section data-testid="pdd-plan-panel" className="space-y-4">
          {session.designDirection ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100">
              <div className="font-semibold">整套设计方向</div>
              <p className="mt-1">{session.designDirection.styleSummary}</p>
              <p className="mt-1 text-xs opacity-80">配色：{session.designDirection.palette || '未填'} · 节奏：{session.designDirection.contrast || '未填'}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={generatingLock} onClick={() => void onGenerateAll()} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900">一键生成全部（串行）</button>
            {queuePhase === 'running' ? <button type="button" onClick={pauseQueue} className="rounded-xl border px-4 py-2 text-sm">暂停队列</button> : null}
            {queuePhase === 'paused' || queuePaused ? <button type="button" onClick={resumeQueue} className="rounded-xl border px-4 py-2 text-sm">继续</button> : null}
            {generatingLock && queuePhase !== 'planning' ? <button type="button" onClick={stopQueue} className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-600">停止队列</button> : null}
            <span className="text-xs text-gray-500">并发为 1，失败会标红并停止，不会自动重试；刷新页面也不会自动重新生成。</span>
          </div>

          {session.cards.map((card) => (
            <StoryboardCard
              key={card.id}
              card={card}
              previewUrl={card.resultImageId ? resultUrls[card.resultImageId] : undefined}
              busy={generatingLock}
              onChange={(patch) => usePddStore.getState().patchCard(card.id, patch)}
              onGenerate={() => { if (!generatingLock) void generateCard(card.id, { imageModel }).catch((err) => showToast(err instanceof Error ? err.message : '生成失败', 'error')) }}
              onRemove={() => { if (!generatingLock) usePddStore.getState().removeCard(card.id) }}
              onPreview={() => usePddStore.getState().setLightbox(card.id)}
              onDownload={() => { if (card.resultImageId) void downloadOriginalPng(card.resultImageId, `pdd-${String(card.index).padStart(2, '0')}-${card.role}.png`) }}
              onDownloadCustom={(width, height) => {
                if (!card.resultImageId) return
                void downloadCustomSizePng(card.resultImageId, width, height, `pdd-${String(card.index).padStart(2, '0')}-${card.role}-${width}x${height}.png`)
                  .catch((err) => showToast(err instanceof Error ? err.message : '导出失败', 'error'))
              }}
            />
          ))}
        </section>
      ) : null}

      {doneCount ? (
        <section data-testid="pdd-gallery-panel" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">套图成品 · {doneCount}/{session.cards.length}</h2>
            <div className="flex flex-wrap items-center gap-3">
              {session.cards.some((card) => customPixelTarget(card.frameSpec)) ? (
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input type="checkbox" checked={zipCustomPixels} onChange={(e) => setZipCustomPixels(e.target.checked)} />
                  按自定义尺寸打包 ZIP（居中 cover 裁切）
                </label>
              ) : null}
              <button
                type="button"
                disabled={zipping}
                onClick={() => {
                  setZipping(true)
                  const name = zipCustomPixels ? `${session.productName || 'pdd-set'}-custom-size.zip` : `${session.productName || 'pdd-set'}.zip`
                  void downloadSetZip(session.cards, name, { customPixels: zipCustomPixels })
                    .then((n) => showToast(zipCustomPixels ? `已按自定义尺寸打包 ${n} 张（客户端 cover 裁切）` : `已打包 ${n} 张原图 PNG`, 'success'))
                    .catch((err) => showToast(err instanceof Error ? err.message : '打包失败', 'error'))
                    .finally(() => setZipping(false))
                }}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white disabled:opacity-50"
              >{zipping ? '打包中…' : zipCustomPixels ? '按自定义尺寸打包 ZIP' : '打包下载整套原图 (.zip)'}</button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {session.cards.map((card) => (
              <button type="button" key={card.id} onClick={() => usePddStore.getState().setLightbox(card.id)} className="overflow-hidden rounded-xl bg-gray-50 text-left dark:bg-gray-800">
                {card.resultImageId && resultUrls[card.resultImageId] ? (
                  <img src={resultUrls[card.resultImageId]} alt={card.title} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-gray-400">{card.status === 'error' ? '失败' : '待生成'}</div>
                )}
                <div className="px-2 py-2 text-xs text-gray-600 dark:text-gray-300">
                  {card.index}. {ROLE_LABELS[card.role]} · {(card.frameSpec && (card.frameSpec.inputMode === 'pixels' ? `${card.frameSpec.width}×${card.frameSpec.height}` : card.aspectRatio)) || card.aspectRatio}
                  <div className="text-[11px] text-gray-400">{formatPixelSize(card.resultWidth, card.resultHeight) || '—'}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activeLightboxCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => usePddStore.getState().setLightbox(null)}>
          <div className="max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-white p-4 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">第 {activeLightboxCard.index} 张 · 原图对比</h3>
              <button type="button" onClick={() => usePddStore.getState().setLightbox(null)}>关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <figure>
                <figcaption className="mb-1 text-xs text-gray-500">上传的商品原图</figcaption>
                {compareUrl ? <img src={compareUrl} alt="商品原图" className="w-full rounded-xl bg-gray-50 object-contain" /> : <div className="text-sm text-gray-400">无原图</div>}
              </figure>
              <figure>
                <figcaption className="mb-1 text-xs text-gray-500">
                  生成结果 {formatPixelSize(activeLightboxCard.resultWidth, activeLightboxCard.resultHeight) || ''}
                  {activeLightboxCard.resultQuality ? ` · ${activeLightboxCard.resultQuality}` : ''}
                </figcaption>
                {activeLightboxCard.resultImageId && resultUrls[activeLightboxCard.resultImageId] ? (
                  <img src={resultUrls[activeLightboxCard.resultImageId]} alt="生成结果原图" className="w-full rounded-xl bg-gray-50 object-contain" />
                ) : <div className="text-sm text-gray-400">还没有生成结果</div>}
              </figure>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
