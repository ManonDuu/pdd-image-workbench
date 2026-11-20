import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import {
  buildGalleryFilterKey,
  detectOffPageNewSuccess,
  intersectSelectionWithPage,
  paginateItems,
  type GalleryPageView,
} from '../lib/galleryPagination'
import { scrollToGalleryListTop } from '../lib/galleryScroll'
import { useStore } from '../store'

interface GalleryPageStore {
  page: number
  newSuccessCount: number
  setPage: (page: number) => void
  jumpToNewSuccess: () => void
  clearNewSuccess: () => void
  addNewSuccess: (count: number) => void
}

export const useGalleryPageStore = create<GalleryPageStore>((set, get) => ({
  page: 1,
  newSuccessCount: 0,
  setPage: (page) => {
    const next = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
    if (next === get().page) return
    set({ page: next })
    useStore.getState().clearSelection()
  },
  jumpToNewSuccess: () => {
    set({ page: 1, newSuccessCount: 0 })
    useStore.getState().clearSelection()
  },
  clearNewSuccess: () => set({ newSuccessCount: 0 }),
  addNewSuccess: (count) => {
    if (count <= 0) return
    set((state) => ({ newSuccessCount: state.newSuccessCount + count }))
  },
}))

export function resetGalleryPaginationState() {
  useGalleryPageStore.setState({ page: 1, newSuccessCount: 0 })
  lastDoneIds = null
  lastFilterKey = null
  hasMountedPage = false
}

let lastDoneIds: string[] | null = null
let lastFilterKey: string | null = null
let hasMountedPage = false

export function useGalleryPagination<T extends { id: string; status: string }>(
  filteredTasks: T[],
): GalleryPageView<T> & {
  newSuccessCount: number
  setPage: (page: number) => void
  jumpToNewSuccess: () => void
} {
  const page = useGalleryPageStore((state) => state.page)
  const newSuccessCount = useGalleryPageStore((state) => state.newSuccessCount)
  const setPage = useGalleryPageStore((state) => state.setPage)
  const jumpToNewSuccess = useGalleryPageStore((state) => state.jumpToNewSuccess)
  const filterKey = useStore((state) => buildGalleryFilterKey({
    searchQuery: state.searchQuery,
    filterStatus: state.filterStatus,
    filterFavorite: state.filterFavorite,
    activeFavoriteCollectionId: state.activeFavoriteCollectionId,
  }))

  const view = useMemo(() => paginateItems(filteredTasks, page), [filteredTasks, page])
  const pageIds = useMemo(() => view.pageItems.map((item) => item.id), [view.pageItems])

  useEffect(() => {
    if (lastFilterKey !== null && lastFilterKey !== filterKey) {
      lastFilterKey = filterKey
      lastDoneIds = filteredTasks.filter((item) => item.status === 'done').map((item) => item.id)
      useGalleryPageStore.getState().clearNewSuccess()
      if (useGalleryPageStore.getState().page !== 1) useGalleryPageStore.getState().setPage(1)
      else useStore.getState().clearSelection()
      return
    }
    lastFilterKey = filterKey
  }, [filterKey, filteredTasks])

  useEffect(() => {
    if (view.page !== page) {
      useGalleryPageStore.setState({ page: view.page })
      useStore.getState().clearSelection()
    }
  }, [view.page, page])

  useEffect(() => {
    const selected = useStore.getState().selectedTaskIds
    const next = intersectSelectionWithPage(selected, pageIds)
    if (next.length !== selected.length) useStore.getState().setSelectedTaskIds(next)
  }, [pageIds])

  useEffect(() => {
    const detected = detectOffPageNewSuccess(lastDoneIds, filteredTasks, pageIds)
    lastDoneIds = detected.nextDoneIds
    if (detected.newOffPageIds.length > 0) {
      useGalleryPageStore.getState().addNewSuccess(detected.newOffPageIds.length)
    }
  }, [filteredTasks, pageIds])

  const previousPageRef = useRef(view.page)
  useEffect(() => {
    const previous = previousPageRef.current
    previousPageRef.current = view.page
    if (!hasMountedPage) {
      hasMountedPage = true
      return
    }
    if (previous === view.page) return
    scrollToGalleryListTop()
  }, [view.page])

  return {
    ...view,
    newSuccessCount,
    setPage,
    jumpToNewSuccess,
  }
}
