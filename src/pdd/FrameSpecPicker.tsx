import { useEffect, useState } from 'react'
import { ASPECT_RATIOS, type FrameSpec } from './types'
import { describeFrame, frameFromPixels, frameFromPreset, frameFromRatio, frameRatioLabel } from './frameSpec'

interface Props {
  value: FrameSpec
  onChange: (value: FrameSpec) => void
  disabled?: boolean
  compact?: boolean
}

export default function FrameSpecPicker({ value, onChange, disabled, compact }: Props) {
  const isCustom = value.inputMode !== 'preset'
  const [mode, setMode] = useState<'pixels' | 'ratio'>(value.inputMode === 'ratio' ? 'ratio' : 'pixels')
  const [pixelW, setPixelW] = useState(String(value.inputMode === 'pixels' ? value.width : 800))
  const [pixelH, setPixelH] = useState(String(value.inputMode === 'pixels' ? value.height : 1000))
  const [ratioW, setRatioW] = useState(String(value.inputMode === 'ratio' ? value.width : 4))
  const [ratioH, setRatioH] = useState(String(value.inputMode === 'ratio' ? value.height : 5))
  const [error, setError] = useState('')

  useEffect(() => {
    if (value.inputMode === 'pixels') {
      setPixelW(String(value.width))
      setPixelH(String(value.height))
      setMode('pixels')
    } else if (value.inputMode === 'ratio') {
      setRatioW(String(value.width))
      setRatioH(String(value.height))
      setMode('ratio')
    }
  }, [value])

  const applyPixels = (w: string, h: string) => {
    const parsed = frameFromPixels(w, h)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setError('')
    onChange(parsed.frame)
  }

  const applyRatio = (w: string, h: string) => {
    const parsed = frameFromRatio(w, h)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setError('')
    onChange(parsed.frame)
  }

  return (
    <div data-testid="pdd-frame-picker" className={compact ? 'space-y-2' : 'space-y-2'}>
      <div className="flex flex-wrap items-center gap-2">
        {ASPECT_RATIOS.map((ratio) => (
          <button
            type="button"
            key={ratio}
            disabled={disabled}
            onClick={() => { setError(''); onChange(frameFromPreset(ratio)) }}
            className={`rounded-full px-3 py-1 text-sm ${!isCustom && value.preset === ratio ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700'}`}
          >
            {ratio}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          data-testid="pdd-frame-custom"
          onClick={() => {
            if (!isCustom) applyPixels(pixelW, pixelH)
          }}
          className={`rounded-full px-3 py-1 text-sm ${isCustom ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700'}`}
        >
          自定义
        </button>
      </div>

      {isCustom ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900/40">
          <div className="flex gap-1 rounded-lg bg-white p-1 dark:bg-gray-950">
            <button type="button" disabled={disabled} className={`rounded-md px-2 py-1 ${mode === 'pixels' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : ''}`} onClick={() => { setMode('pixels'); applyPixels(pixelW, pixelH) }}>像素 (px)</button>
            <button type="button" disabled={disabled} className={`rounded-md px-2 py-1 ${mode === 'ratio' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : ''}`} onClick={() => { setMode('ratio'); applyRatio(ratioW, ratioH) }}>比例</button>
          </div>
          {mode === 'pixels' ? (
            <label className="flex items-center gap-1 text-xs text-gray-500">
              宽
              <input data-testid="pdd-frame-pixel-w" disabled={disabled} inputMode="numeric" className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" value={pixelW} onChange={(e) => { setPixelW(e.target.value); applyPixels(e.target.value, pixelH) }} />
              × 高
              <input data-testid="pdd-frame-pixel-h" disabled={disabled} inputMode="numeric" className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" value={pixelH} onChange={(e) => { setPixelH(e.target.value); applyPixels(pixelW, e.target.value) }} />
            </label>
          ) : (
            <label className="flex items-center gap-1 text-xs text-gray-500">
              宽
              <input data-testid="pdd-frame-ratio-w" disabled={disabled} inputMode="numeric" className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" value={ratioW} onChange={(e) => { setRatioW(e.target.value); applyRatio(e.target.value, ratioH) }} />
              : 高
              <input data-testid="pdd-frame-ratio-h" disabled={disabled} inputMode="numeric" className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" value={ratioH} onChange={(e) => { setRatioH(e.target.value); applyRatio(ratioW, e.target.value) }} />
            </label>
          )}
          <span className="text-xs text-gray-500">≈ {frameRatioLabel(value)} · {describeFrame(value)}</span>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
