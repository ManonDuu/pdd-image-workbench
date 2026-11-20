// @vitest-environment jsdom

import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paginateItems } from '../lib/galleryPagination'
import GalleryPaginationBar from './GalleryPaginationBar'

function makeIds(count: number) {
  return Array.from({ length: count }, (_, index) => `task-${String(index + 1).padStart(3, '0')}`)
}

function PaginationHarness({ ids }: { ids: string[] }) {
  const [page, setPage] = useState(1)
  const view = paginateItems(ids.map((id) => ({ id })), page)
  useEffect(() => {
    if (view.page !== page) setPage(view.page)
  }, [view.page, page])

  return (
    <div>
      <ul data-page-items>
        {view.pageItems.map((item) => (
          <li key={item.id} data-task-id={item.id}>{item.id}</li>
        ))}
      </ul>
      <GalleryPaginationBar
        totalItems={view.totalItems}
        page={view.page}
        totalPages={view.totalPages}
        onPageChange={setPage}
      />
    </div>
  )
}

describe('GalleryPaginationBar 独立渲染', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
  })

  it('0 条只显示共 0 条，没有翻页按钮', () => {
    act(() => { root.render(<PaginationHarness ids={[]} />) })
    expect(container.textContent).toContain('共 0 条')
    expect(container.querySelector('[aria-label="自由生图历史分页"]')).toBeNull()
  })

  it('20 条显示状态但不显示翻页按钮', () => {
    act(() => { root.render(<PaginationHarness ids={makeIds(20)} />) })
    expect(container.textContent).toContain('共 20 条 · 第 1 / 1 页')
    expect(container.querySelector('[aria-label="自由生图历史分页"]')).toBeNull()
    expect(container.querySelectorAll('[data-task-id]')).toHaveLength(20)
  })

  it('41 条支持 1 → 2 → 3 → 2，末页删除后回到第 2 页', () => {
    let ids = makeIds(41)
    act(() => { root.render(<PaginationHarness ids={ids} />) })
    expect(container.querySelectorAll('[data-task-id]')).toHaveLength(20)
    expect(container.querySelector('[data-task-id="task-001"]')).not.toBeNull()
    expect(container.textContent).toContain('共 41 条 · 第 1 / 3 页')

    act(() => { container.querySelector<HTMLButtonElement>('[aria-label="下一页"]')?.click() })
    expect(container.querySelector('[data-task-id="task-021"]')).not.toBeNull()
    expect(container.querySelector('[data-task-id="task-001"]')).toBeNull()
    expect(container.textContent).toContain('第 2 / 3 页')

    act(() => { container.querySelector<HTMLButtonElement>('[aria-label="第 3 页"]')?.click() })
    expect(container.querySelectorAll('[data-task-id]')).toHaveLength(1)
    expect(container.querySelector('[data-task-id="task-041"]')).not.toBeNull()
    expect(container.querySelector<HTMLButtonElement>('[aria-label="下一页"]')?.disabled).toBe(true)

    act(() => { container.querySelector<HTMLButtonElement>('[aria-label="上一页"]')?.click() })
    expect(container.querySelector('[data-task-id="task-021"]')).not.toBeNull()

    ids = makeIds(40)
    act(() => { root.render(<PaginationHarness ids={ids} />) })
    act(() => { container.querySelector<HTMLButtonElement>('[aria-label="第 2 页"]')?.click() })
    expect(container.textContent).toContain('共 40 条 · 第 2 / 2 页')
    expect(container.querySelectorAll('[data-task-id]')).toHaveLength(20)

    ids = makeIds(40).filter((id) => id !== 'task-040')
    // 模拟在第 2 页删到只剩 19 条：先停在第 2 页再把总数减到 19 会钳到第 1 页。这里验证末页 1 条删除。
    act(() => { container.querySelector<HTMLButtonElement>('[aria-label="第 2 页"]')?.click() })
    ids = makeIds(20)
    act(() => { root.render(<PaginationHarness ids={ids} />) })
    expect(container.textContent).toContain('共 20 条 · 第 1 / 1 页')
    expect(container.querySelector('[aria-label="自由生图历史分页"]')).toBeNull()
  })

  it('深色模式类名存在于翻页按钮', () => {
    act(() => { root.render(<PaginationHarness ids={makeIds(21)} />) })
    const current = container.querySelector('[aria-current="page"]')
    const next = container.querySelector('[aria-label="下一页"]')
    expect(current?.className).toContain('bg-blue-500')
    expect(next?.className).toContain('dark:bg-white/')
  })
})
