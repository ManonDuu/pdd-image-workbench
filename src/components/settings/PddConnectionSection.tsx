import { useState } from 'react'
import { detectConnection } from '../../pdd/api'
import { usePddStore } from '../../pdd/store'

/** 设置页里的简要连接检测，不读取或展示密钥原文。 */
export default function PddConnectionSection() {
  const planningModel = usePddStore((s) => s.planningModel)
  const imageModel = usePddStore((s) => s.imageModel)
  const detected = usePddStore((s) => s.detected)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const onDetect = async () => {
    setBusy(true)
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
        const nextPlanning = planningModel && result.planningIds.includes(planningModel) ? planningModel : result.recommendedPlanning || ''
        const nextImage = imageModel && result.imageIds.includes(imageModel) ? imageModel : result.recommendedImage || ''
        usePddStore.getState().setModels(nextPlanning, nextImage)
        setMessage(`已连接 ${result.baseUrlHost}，推荐规划 ${nextPlanning || '未识别'}，生图 ${nextImage || '未识别'}。`)
      } else {
        setMessage(result.error || '检测失败')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">套图工作台连接</h4>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Base URL 默认提示 <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">http://127.0.0.1:62037/v1</code>。API Key 只保存在本机浏览器，请在「API」选项卡填写，不要写入项目文件。
      </p>
      <button type="button" disabled={busy} onClick={() => void onDetect()} className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900">
        {busy ? '检测中…' : '检测连接 / 获取模型'}
      </button>
      {message ? <p className="text-sm text-gray-500">{message}</p> : null}
      {detected?.recommendedPlanning || detected?.recommendedImage ? (
        <p className="text-xs text-gray-500">当前工作台模型：规划 {planningModel || '未选'} · 生图 {imageModel || '未选'}。不会默认使用 gpt-image-2.6-sunburst。</p>
      ) : null}
    </section>
  )
}
