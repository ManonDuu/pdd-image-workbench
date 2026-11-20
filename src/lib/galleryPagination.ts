export const GALLERY_PAGE_SIZE = 20

export type GalleryPageToken = number | 'ellipsis'

export interface GalleryPageView<T> {
  page: number
  totalItems: number
  totalPages: number
  pageSize: number
  startIndex: number
  endIndex: number
  pageItems: T[]
}

export function getTotalPages(totalItems: number, pageSize: number = GALLERY_PAGE_SIZE): number {
  if (totalItems <= 0 || pageSize <= 0) return 0
  return Math.ceil(totalItems / pageSize)
}

export function clampPage(page: number, totalItems: number, pageSize: number = GALLERY_PAGE_SIZE): number {
  const totalPages = getTotalPages(totalItems, pageSize)
  if (totalPages <= 0) return 1
  const raw = Number.isFinite(page) ? Math.floor(page) : 1
  return Math.min(totalPages, Math.max(1, raw))
}

export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number = GALLERY_PAGE_SIZE,
): GalleryPageView<T> {
  const totalItems = items.length
  const totalPages = getTotalPages(totalItems, pageSize)
  const safePage = clampPage(page, totalItems, pageSize)
  const startIndex = totalPages === 0 ? 0 : (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)
  return {
    page: safePage,
    totalItems,
    totalPages,
    pageSize,
    startIndex,
    endIndex,
    pageItems: items.slice(startIndex, endIndex) as T[],
  }
}

/** 页数较多时保留首尾页和当前页邻近页，单个空洞直接补页码，避免 1 … 3 这种无意义省略。 */
export function getVisiblePageTokens(
  current: number,
  totalPages: number,
  siblingCount: number = 1,
): GalleryPageToken[] {
  if (totalPages <= 0) return []
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set<number>()
  pages.add(1)
  pages.add(totalPages)
  const safeCurrent = Math.min(totalPages, Math.max(1, Math.floor(current) || 1))
  for (let page = safeCurrent - siblingCount; page <= safeCurrent + siblingCount; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const tokens: GalleryPageToken[] = []
  let previous = 0
  for (const page of sorted) {
    if (previous > 0 && page - previous > 1) {
      if (page - previous === 2) tokens.push(previous + 1)
      else tokens.push('ellipsis')
    }
    tokens.push(page)
    previous = page
  }
  return tokens
}

export function selectCurrentPageIds(pageIds: readonly string[]): string[] {
  return [...pageIds]
}

export function invertPageSelection(selectedIds: readonly string[], pageIds: readonly string[]): string[] {
  const pageSet = new Set(pageIds)
  const selectedSet = new Set(selectedIds)
  const offPage = selectedIds.filter((id) => !pageSet.has(id))
  const invertedOnPage = pageIds.filter((id) => !selectedSet.has(id))
  return [...offPage, ...invertedOnPage]
}

export function intersectSelectionWithPage(selectedIds: readonly string[], pageIds: readonly string[]): string[] {
  const pageSet = new Set(pageIds)
  return selectedIds.filter((id) => pageSet.has(id))
}

export function buildGalleryFilterKey(input: {
  searchQuery: string
  filterStatus: string
  filterFavorite: boolean
  activeFavoriteCollectionId: string | null
}): string {
  return [
    input.searchQuery,
    input.filterStatus,
    input.filterFavorite ? '1' : '0',
    input.activeFavoriteCollectionId ?? '',
  ].join('\0')
}

export function formatGalleryPageStatus(totalItems: number, page: number, totalPages: number): string {
  if (totalItems <= 0) return '共 0 条'
  return `共 ${totalItems} 条 · 第 ${page} / ${totalPages} 页`
}

export function detectOffPageNewSuccess(
  previousDoneIds: Iterable<string> | null,
  currentItems: readonly { id: string; status: string }[],
  pageIds: Iterable<string>,
): { nextDoneIds: string[]; newOffPageIds: string[] } {
  const nextDoneIds = currentItems.filter((item) => item.status === 'done').map((item) => item.id)
  if (previousDoneIds == null) {
    return { nextDoneIds, newOffPageIds: [] }
  }
  const previous = new Set(previousDoneIds)
  const pageSet = new Set(pageIds)
  const newOffPageIds = nextDoneIds.filter((id) => !previous.has(id) && !pageSet.has(id))
  return { nextDoneIds, newOffPageIds }
}

/** 打开批量删除确认时冻结选中 ID，避免确认期间新记录改变页边界后误删。 */
export function snapshotSelectedIds(selectedIds: readonly string[]): string[] {
  return [...selectedIds]
}
