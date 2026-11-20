import { useSyncExternalStore } from 'react'

export type WorkbenchView = 'pdd' | 'free'

const KEY = 'pdd-workbench-view'
const listeners = new Set<() => void>()

function read(): WorkbenchView {
  try {
    return localStorage.getItem(KEY) === 'free' ? 'free' : 'pdd'
  } catch {
    return 'pdd'
  }
}

export function getWorkbenchView(): WorkbenchView {
  return read()
}

export function setWorkbenchView(view: WorkbenchView) {
  try {
    localStorage.setItem(KEY, view)
  } catch {
    /* ignore quota */
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) fn()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

export function useWorkbenchView(): [WorkbenchView, (view: WorkbenchView) => void] {
  const view = useSyncExternalStore(subscribe, read, () => 'pdd' as const)
  return [view, setWorkbenchView]
}
