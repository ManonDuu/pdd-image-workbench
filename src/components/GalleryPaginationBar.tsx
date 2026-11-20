import { formatGalleryPageStatus, getVisiblePageTokens } from '../lib/galleryPagination'

export default function GalleryPaginationBar({
  totalItems,
  page,
  totalPages,
  newSuccessCount = 0,
  onPageChange,
  onJumpToNewSuccess,
}: {
  totalItems: number
  page: number
  totalPages: number
  newSuccessCount?: number
  onPageChange: (page: number) => void
  onJumpToNewSuccess?: () => void
}) {
  if (totalItems <= 0) {
    return (
      <div
        data-no-drag-select
        data-gallery-pagination
        className="mt-4 mb-2 text-center text-sm text-gray-400 dark:text-gray-500"
      >
        {formatGalleryPageStatus(0, 1, 0)}
      </div>
    )
  }

  const tokens = getVisiblePageTokens(page, totalPages)
  const atFirst = page <= 1
  const atLast = page >= totalPages

  return (
    <div
      data-no-drag-select
      data-gallery-pagination
      className="mt-6 mb-2 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-between"
    >
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <p>{formatGalleryPageStatus(totalItems, page, totalPages)}</p>
        {newSuccessCount > 0 && onJumpToNewSuccess ? (
          <button
            type="button"
            onClick={onJumpToNewSuccess}
            className="rounded-lg px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-blue-400"
          >
            {newSuccessCount === 1 ? '有新成功记录' : `有 ${newSuccessCount} 条新成功记录`}
          </button>
        ) : null}
      </div>
      {totalPages > 1 ? (
        <nav aria-label="自由生图历史分页" className="flex flex-wrap items-center justify-center gap-1">
          <PaginationButton
            label="上一页"
            disabled={atFirst}
            onClick={() => onPageChange(page - 1)}
          />
          {tokens.map((token, index) => (
            token === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1.5 text-sm text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <PaginationButton
                key={token}
                label={`第 ${token} 页`}
                current={token === page}
                onClick={() => onPageChange(token)}
              >
                {token}
              </PaginationButton>
            )
          ))}
          <PaginationButton
            label="下一页"
            disabled={atLast}
            onClick={() => onPageChange(page + 1)}
          />
        </nav>
      ) : null}
    </div>
  )
}

function PaginationButton({
  label,
  onClick,
  disabled = false,
  current = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  current?: boolean
  children?: number | string
}) {
  const isNav = children == null
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={[
        'min-w-[2.25rem] rounded-xl px-2.5 py-1.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/30',
        isNav ? 'px-3' : '',
        current
          ? 'bg-blue-500 text-white hover:bg-blue-600'
          : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]',
        disabled ? 'cursor-not-allowed opacity-45 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]' : '',
      ].join(' ')}
    >
      {children ?? label}
    </button>
  )
}
