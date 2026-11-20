// @vitest-environment jsdom

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store'
import { useGalleryPagination, resetGalleryPaginationState, useGalleryPageStore } from './useGalleryPagination'

vi.mock('../lib/galleryScroll', () => ({
  scrollToGalleryListTop: vi.fn(),
}))

interface MockTask {
  id: string
  status: 'done' | 'running' | 'error'
}

function makeTasks(count: number, start = 1, status: MockTask['status'] = 'done'): MockTask[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `task-${String(start + index).padStart(3, '0')}`,
    status,
  }))
}

function HookProbe({
  tasks,
  onView,
}: {
  tasks: MockTask[]
  onView: (view: ReturnType<typeof useGalleryPagination<MockTask>>) => void
}) {
  const view = useGalleryPagination(tasks)
  onView(view)
  return (
    <div>
      <span data-page={view.page} data-total={view.totalItems} data-pages={view.totalPages}>
        {view.pageItems.map((task) => task.id).join(',')}
      </span>
      <button type="button" onClick={() => view.setPage(view.page + 1)}>next</button>
    </div>
  )
}

describe('useGalleryPagination', () => {
  let root: Root
  let container: HTMLDivElement
  let latest: ReturnType<typeof useGalleryPagination<MockTask>> | null = null

  function render(element: ReactElement) {
    act(() => { root.render(element) })
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    resetGalleryPaginationState()
    useStore.setState({
      searchQuery: '',
      filterStatus: 'all',
      filterFavorite: false,
      activeFavoriteCollectionId: null,
      selectedTaskIds: [],
    } as never)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    resetGalleryPaginationState()
  })

  it('41 条记录渲染第 1 页 20 条，切到第 3 页后再回到第 2 页', () => {
    const tasks = makeTasks(41)
    render(<HookProbe tasks={tasks} onView={(view) => { latest = view }} />)
    expect(latest?.page).toBe(1)
    expect(latest?.pageItems).toHaveLength(20)
    expect(latest?.totalPages).toBe(3)
    act(() => { latest?.setPage(3) })
    render(<HookProbe tasks={tasks} onView={(view) => { latest = view }} />)
    expect(latest?.page).toBe(3)
    expect(latest?.pageItems.map((task) => task.id)).toEqual(['task-041'])
    act(() => { latest?.setPage(2) })
    render(<HookProbe tasks={tasks} onView={(view) => { latest = view }} />)
    expect(latest?.page).toBe(2)
    expect(latest?.pageItems).toHaveLength(20)
    expect(latest?.pageItems[0]?.id).toBe('task-021')
  })

  it('最后一页删除后自动钳制，筛选变化回到第 1 页并清空选择', () => {
    const tasks = makeTasks(41)
    render(<HookProbe tasks={tasks} onView={(view) => { latest = view }} />)
    act(() => { latest?.setPage(3) })
    useStore.setState({ selectedTaskIds: ['task-041'] })
    render(<HookProbe tasks={tasks} onView={(view) => { latest = view }} />)
    expect(latest?.page).toBe(3)

    render(<HookProbe tasks={makeTasks(40)} onView={(view) => { latest = view }} />)
    expect(latest?.page).toBe(2)
    expect(latest?.totalPages).toBe(2)
    expect(useStore.getState().selectedTaskIds).toEqual([])

    act(() => { latest?.setPage(2) })
    useStore.setState({ selectedTaskIds: ['task-021'], filterStatus: 'done' } as never)
    render(<HookProbe tasks={makeTasks(21)} onView={(view) => { latest = view }} />)
    expect(latest?.page).toBe(1)
    expect(useStore.getState().selectedTaskIds).toEqual([])
  })

  it('全选作用域由当前页决定；新成功记录不把用户拽离旧页', () => {
    const tasks = makeTasks(41)
    render(<HookProbe tasks={tasks} onView={(view) => { latest = view }} />)
    act(() => { latest?.setPage(2) })
    render(<HookProbe tasks={tasks} onView={(view) => { latest = view }} />)
    const pageIds = latest!.pageItems.map((task) => task.id)
    act(() => { useStore.getState().setSelectedTaskIds(pageIds) })
    expect(useStore.getState().selectedTaskIds).toHaveLength(20)
    expect(useStore.getState().selectedTaskIds.includes('task-001')).toBe(false)

    const withNew = [{ id: 'task-new', status: 'done' as const }, ...tasks]
    render(<HookProbe tasks={withNew} onView={(view) => { latest = view }} />)
    expect(latest?.page).toBe(2)
    expect(useGalleryPageStore.getState().newSuccessCount).toBe(1)
    expect(latest?.pageItems.map((task) => task.id)).not.toContain('task-new')
    expect(latest?.pageItems).toHaveLength(20)
  })
})
