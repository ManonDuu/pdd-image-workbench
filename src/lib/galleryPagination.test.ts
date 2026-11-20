import { describe, expect, it } from 'vitest'
import {
  GALLERY_PAGE_SIZE,
  buildGalleryFilterKey,
  clampPage,
  detectOffPageNewSuccess,
  formatGalleryPageStatus,
  getTotalPages,
  getVisiblePageTokens,
  intersectSelectionWithPage,
  invertPageSelection,
  paginateItems,
  selectCurrentPageIds,
  snapshotSelectedIds,
} from './galleryPagination'

interface MockTask {
  id: string
  status: 'done' | 'running' | 'error'
  outputImages?: string[]
}

function makeTasks(count: number, extra?: Partial<MockTask> | ((index: number) => Partial<MockTask>)): MockTask[] {
  return Array.from({ length: count }, (_, index) => {
    const patch = typeof extra === 'function' ? extra(index) : extra
    return {
      id: `task-${String(index + 1).padStart(3, '0')}`,
      status: 'done',
      outputImages: ['img-a'],
      ...patch,
    }
  })
}

describe('galleryPagination 单位与页数', () => {
  it('以任务记录为分页单位，多图任务只占 1 个名额', () => {
    const tasks = [
      { id: 'multi', status: 'done' as const, outputImages: ['a', 'b', 'c', 'd', 'e'] },
      ...makeTasks(19),
    ]
    expect(tasks).toHaveLength(20)
    const view = paginateItems(tasks, 1)
    expect(view.totalItems).toBe(20)
    expect(view.totalPages).toBe(1)
    expect(view.pageItems).toHaveLength(20)
    expect(view.pageItems[0]?.id).toBe('multi')
    expect(view.pageItems[0]?.outputImages).toHaveLength(5)
  })

  it('0 条：空结果、第 1 页、无页码', () => {
    const view = paginateItems([], 3)
    expect(view).toMatchObject({ page: 1, totalItems: 0, totalPages: 0, startIndex: 0, endIndex: 0, pageItems: [] })
    expect(getTotalPages(0)).toBe(0)
    expect(getVisiblePageTokens(1, 0)).toEqual([])
    expect(formatGalleryPageStatus(0, 1, 0)).toBe('共 0 条')
  })

  it('20 条正好一页', () => {
    const view = paginateItems(makeTasks(20), 1)
    expect(view.totalPages).toBe(1)
    expect(view.pageItems).toHaveLength(20)
    expect(view.page).toBe(1)
    expect(getVisiblePageTokens(1, 1)).toEqual([1])
    expect(formatGalleryPageStatus(20, 1, 1)).toBe('共 20 条 · 第 1 / 1 页')
  })

  it('21 条分成 2 页，第 2 页 1 条', () => {
    const tasks = makeTasks(21)
    const page1 = paginateItems(tasks, 1)
    const page2 = paginateItems(tasks, 2)
    expect(page1.totalPages).toBe(2)
    expect(page1.pageItems.map((task) => task.id)).toEqual(makeTasks(20).map((task) => task.id))
    expect(page2.pageItems).toHaveLength(1)
    expect(page2.pageItems[0]?.id).toBe('task-021')
    expect(page2.startIndex).toBe(20)
    expect(page2.endIndex).toBe(21)
  })

  it('41 条分成 3 页（20+20+1），请求过大页码钳制到最后一页', () => {
    const tasks = makeTasks(41)
    expect(GALLERY_PAGE_SIZE).toBe(20)
    const last = paginateItems(tasks, 99)
    expect(last.totalPages).toBe(3)
    expect(last.page).toBe(3)
    expect(last.pageItems).toHaveLength(1)
    expect(last.pageItems[0]?.id).toBe('task-041')
    expect(paginateItems(tasks, 2).pageItems).toHaveLength(20)
    expect(paginateItems(tasks, 2).pageItems[0]?.id).toBe('task-021')
  })

  it('页码省略号：长页数保留首尾和邻近页', () => {
    expect(getVisiblePageTokens(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(getVisiblePageTokens(10, 30)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 30])
    expect(getVisiblePageTokens(2, 30)).toEqual([1, 2, 3, 'ellipsis', 30])
    expect(getVisiblePageTokens(29, 30)).toEqual([1, 'ellipsis', 28, 29, 30])
    expect(getVisiblePageTokens(1, 30)).toEqual([1, 2, 'ellipsis', 30])
  })
})

describe('galleryPagination 删除钳制与筛选重置', () => {
  it('最后一页只剩 1 条被删除后，回退到新的最后一页', () => {
    const afterDelete = makeTasks(40)
    expect(clampPage(3, afterDelete.length)).toBe(2)
    const view = paginateItems(afterDelete, 3)
    expect(view.page).toBe(2)
    expect(view.totalPages).toBe(2)
    expect(view.pageItems).toHaveLength(20)
  })

  it('删到 0 条时页码回到 1', () => {
    expect(clampPage(4, 0)).toBe(1)
    expect(paginateItems([], 2).page).toBe(1)
  })

  it('筛选或排序变化用新的 filterKey 表示，应回到第 1 页', () => {
    const before = buildGalleryFilterKey({
      searchQuery: '',
      filterStatus: 'all',
      filterFavorite: false,
      activeFavoriteCollectionId: null,
    })
    const afterSearch = buildGalleryFilterKey({
      searchQuery: '捏捏乐',
      filterStatus: 'all',
      filterFavorite: false,
      activeFavoriteCollectionId: null,
    })
    const afterStatus = buildGalleryFilterKey({
      searchQuery: '',
      filterStatus: 'done',
      filterFavorite: false,
      activeFavoriteCollectionId: null,
    })
    const afterFavorite = buildGalleryFilterKey({
      searchQuery: '',
      filterStatus: 'all',
      filterFavorite: true,
      activeFavoriteCollectionId: null,
    })
    expect(before).not.toBe(afterSearch)
    expect(before).not.toBe(afterStatus)
    expect(before).not.toBe(afterFavorite)
    expect(clampPage(1, 21)).toBe(1)
  })
})

describe('galleryPagination 选择作用域与新记录', () => {
  it('全选只覆盖当前页 ID', () => {
    const pageIds = paginateItems(makeTasks(41), 2).pageItems.map((task) => task.id)
    expect(pageIds).toHaveLength(20)
    expect(selectCurrentPageIds(pageIds)).toEqual(pageIds)
    expect(selectCurrentPageIds(pageIds).includes('task-001')).toBe(false)
    expect(selectCurrentPageIds(pageIds).includes('task-041')).toBe(false)
  })

  it('反选只翻转当前页，不把其他页藏起来的记录选进来', () => {
    const pageIds = ['task-021', 'task-022', 'task-023']
    const selected = ['task-021', 'task-001']
    expect(invertPageSelection(selected, pageIds)).toEqual(['task-001', 'task-022', 'task-023'])
  })

  it('同页数据更新时，选择与当前页 ID 取交集', () => {
    expect(intersectSelectionWithPage(['task-021', 'task-022', 'task-001'], ['task-021', 'task-023'])).toEqual(['task-021'])
  })

  it('确认删除前冻结的选中 ID 不受之后页边界变化影响', () => {
    const snapped = snapshotSelectedIds(['task-041'])
    const afterNewRecord = makeTasks(42)
    const shiftedLastPage = paginateItems(afterNewRecord, 3).pageItems.map((task) => task.id)
    expect(shiftedLastPage).toContain('task-041')
    expect(snapped).toEqual(['task-041'])
  })

  it('初次载入旧历史不提示新成功记录', () => {
    const tasks = makeTasks(41)
    const pageIds = paginateItems(tasks, 2).pageItems.map((task) => task.id)
    const result = detectOffPageNewSuccess(null, tasks, pageIds)
    expect(result.newOffPageIds).toEqual([])
    expect(result.nextDoneIds).toHaveLength(41)
  })

  it('用户停留在旧页时，新成功记录计入提示且不改变当前页码', () => {
    const existing = makeTasks(41)
    const onPage2 = paginateItems(existing, 2)
    expect(onPage2.page).toBe(2)
    const withNew = [{ id: 'task-new', status: 'done' as const, outputImages: ['x'] }, ...existing]
    const stillPage2 = paginateItems(withNew, onPage2.page)
    expect(stillPage2.page).toBe(2)
    const detected = detectOffPageNewSuccess(
      existing.map((task) => task.id),
      withNew,
      stillPage2.pageItems.map((task) => task.id),
    )
    expect(detected.newOffPageIds).toEqual(['task-new'])
    expect(stillPage2.pageItems[0]?.id).not.toBe('task-new')
  })

  it('当前页 running 转为 done 不提示；被筛选排除的新任务也不提示', () => {
    const pageTasks: MockTask[] = [
      { id: 'task-running', status: 'running' },
      ...makeTasks(19),
    ]
    const afterSuccess: MockTask[] = pageTasks.map((task) => (
      task.id === 'task-running' ? { ...task, status: 'done' } : task
    ))
    const pageIds = afterSuccess.map((task) => task.id)
    const onPage = detectOffPageNewSuccess(
      pageTasks.filter((task) => task.status === 'done').map((task) => task.id),
      afterSuccess,
      pageIds,
    )
    expect(onPage.newOffPageIds).toEqual([])

    const filteredWithoutNew = makeTasks(21)
    const ignored = detectOffPageNewSuccess(
      filteredWithoutNew.map((task) => task.id),
      filteredWithoutNew,
      paginateItems(filteredWithoutNew, 2).pageItems.map((task) => task.id),
    )
    expect(ignored.newOffPageIds).toEqual([])
  })
})
