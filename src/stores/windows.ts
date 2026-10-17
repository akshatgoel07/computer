import { create } from 'zustand'
import { apps, type AppId } from '@/lib/apps'
import { useShellStore } from '@/stores/shellStore'
import { visibleRect, type Rect } from '@/lib/windowGeometry'

export type WindowRecord = {
  id: AppId
  appId: AppId
  title: string
  normalRect: Rect
  mode: 'normal' | 'maximized'
  minimized: boolean
}

type WindowStore = {
  windows: Partial<Record<AppId, WindowRecord>>
  order: AppId[]
  activeId: AppId | null
  desktopRestoreIds: AppId[]
  open: (appId: AppId) => void
  close: (id: AppId) => void
  focus: (id: AppId) => void
  minimize: (id: AppId) => void
  maximize: (id: AppId) => void
  restore: (id: AppId) => void
  move: (id: AppId, rect: Rect) => void
  toggleMaximize: (id: AppId) => void
  toggleDesktop: () => void
  reset: () => void
}

function topVisible(windows: WindowStore['windows'], order: AppId[]) {
  return [...order].reverse().find(id => windows[id] && !windows[id]?.minimized) ?? null
}

export const useWindows = create<WindowStore>((set, get) => ({
  windows: {}, order: [], activeId: null, desktopRestoreIds: [],
  open: appId => {
    useShellStore.getState().recordLaunch(appId)
    const state = get()
    if (state.windows[appId]) return state.restore(appId)
    const offset = state.order.length * 24
    const record: WindowRecord = {
      id: appId, appId, title: apps[appId].title,
      normalRect: visibleRect({ x: 80 + offset, y: 60 + offset, width: 800, height: 520 }),
      mode: 'normal', minimized: false,
    }
    set({ windows: { ...state.windows, [appId]: record }, order: [...state.order, appId], activeId: appId, desktopRestoreIds: [] })
  },
  close: id => set(state => {
    const windows = { ...state.windows }
    delete windows[id]
    const order = state.order.filter(item => item !== id)
    return { windows, order, activeId: topVisible(windows, order), desktopRestoreIds: state.desktopRestoreIds.filter(item => item !== id) }
  }),
  focus: id => set(state => !state.windows[id] || state.windows[id]?.minimized ? state : ({
    order: [...state.order.filter(item => item !== id), id], activeId: id,
  })),
  minimize: id => set(state => {
    const record = state.windows[id]
    if (!record) return state
    const windows = { ...state.windows, [id]: { ...record, minimized: true } }
    return { windows, activeId: topVisible(windows, state.order) }
  }),
  maximize: id => set(state => {
    const record = state.windows[id]
    return record ? { windows: { ...state.windows, [id]: { ...record, mode: 'maximized', minimized: false } }, activeId: id, order: [...state.order.filter(item => item !== id), id] } : state
  }),
  restore: id => set(state => {
    const record = state.windows[id]
    return record ? { windows: { ...state.windows, [id]: { ...record, minimized: false } }, activeId: id, order: [...state.order.filter(item => item !== id), id] } : state
  }),
  move: (id, normalRect) => set(state => {
    const record = state.windows[id]
    return record ? { windows: { ...state.windows, [id]: { ...record, normalRect: visibleRect(normalRect) } } } : state
  }),
  toggleMaximize: id => set(state => {
    const record = state.windows[id]
    return record ? { windows: { ...state.windows, [id]: { ...record, mode: record.mode === 'normal' ? 'maximized' : 'normal' } } } : state
  }),
  toggleDesktop: () => set(state => {
    const restore = state.desktopRestoreIds.length > 0
    const ids = restore ? state.desktopRestoreIds : state.order.filter(id => !state.windows[id]?.minimized)
    const windows = { ...state.windows }
    for (const id of ids) {
      const record = windows[id]
      if (record) windows[id] = { ...record, minimized: !restore }
    }
    return { windows, desktopRestoreIds: restore ? [] : ids, activeId: topVisible(windows, state.order) }
  }),
  reset: () => set({ windows: {}, order: [], activeId: null, desktopRestoreIds: [] }),
}))
