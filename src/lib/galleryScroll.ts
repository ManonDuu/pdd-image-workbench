import { getPageScroller } from './pageScroll'

/** 切页时把记录列表区域滚到固定顶栏下方，不影响底部固定输入栏。 */
export function scrollToGalleryListTop() {
  if (typeof document === 'undefined') return
  const marker = document.querySelector<HTMLElement>('[data-gallery-list-top], [data-home-main], [data-task-grid-root]')
  if (!marker) return
  const header = document.querySelector<HTMLElement>('header')
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0
  const delta = marker.getBoundingClientRect().top - headerBottom - 8
  if (Math.abs(delta) < 1) return
  const scroller = getPageScroller()
  scroller.scrollBy({ top: delta, behavior: 'smooth' })
}
