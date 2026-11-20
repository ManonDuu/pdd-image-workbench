import { TEXT_PRIMARY_PRESETS, colorFromHex, describeTextPrimaryColor, normalizeHex, type TextPrimaryColor } from './colors'

interface Props {
  value: TextPrimaryColor | null | undefined
  onChange: (value: TextPrimaryColor | null) => void
  disabled?: boolean
}

export default function TextPrimaryColorPicker({ value, onChange, disabled }: Props) {
  const selectedHex = value ? normalizeHex(value.hex) : null
  const isCustom = Boolean(selectedHex && !TEXT_PRIMARY_PRESETS.some((item) => item.hex === selectedHex))

  return (
    <div data-testid="pdd-text-color" className="space-y-2">
      <div className="text-sm text-gray-600">文案主色</div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          data-testid="pdd-color-auto"
          onClick={() => onChange(null)}
          className={`rounded-full px-3 py-1 text-sm ${!value ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700'}`}
        >
          AI 自动
        </button>
        {TEXT_PRIMARY_PRESETS.map((color) => {
          const selected = selectedHex === color.hex
          return (
            <button
              key={color.hex}
              type="button"
              disabled={disabled}
              title={`${color.name} ${color.hex}`}
              data-testid={`pdd-color-${color.hex.slice(1)}`}
              onClick={() => onChange(color)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${selected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full ${color.hex === '#FFFFFF' ? 'border border-gray-300' : 'border border-black/10'}`}
                style={{ backgroundColor: color.hex }}
              />
              {color.name}
            </button>
          )
        })}
        <label className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${isCustom ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'}`}>
          <input
            type="color"
            data-testid="pdd-color-custom"
            disabled={disabled}
            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
            value={selectedHex || '#1D4ED8'}
            onChange={(e) => onChange(colorFromHex(e.target.value))}
            aria-label="自定义主色"
          />
          自定义
        </label>
      </div>
      <p className="text-xs text-gray-500">
        {value
          ? `已选主色：${describeTextPrimaryColor(value)} · 撞色由 AI 按商品图自动搭配`
          : '默认由 AI 根据商品图自由搭配主色与撞色。'}
      </p>
    </div>
  )
}
