import { create } from 'zustand'
import { apps, appLocations, type AppId } from '@/lib/apps'
import { useShellStore } from '@/stores/shellStore'
import type { Location } from '@/fs/types'
import { useExplorerStore } from '@/stores/explorerStore'
import { locationName } from '@/fs/paths'
import { useFilesStore } from '@/stores/filesStore'
import { visibleRect, type Rect } from '@/lib/windowGeometry'

export type WindowRecord = {
  id: string
  appId: AppId
  title: string
  launchContext: { kind: 'explorer'; location: Location } | { kind: 'none' }
  normalRect: Rect
  mode: 'normal' | 'maximized'
  minimized: boolean
}

type WindowStore = {
  windows: Partial<Record<string, WindowRecord>>
  order: string[]
  activeId: string | null
  desktopRestoreIds: string[]
  open: (appId: AppId, location?: Location) => void
  close: (id: string) => void
  focus: (id: string) => void
  minimize: (id: string) => void
  maximize: (id: string) => void
  restore: (id: string) => void
  move: (id: string, rect: Rect) => void
  toggleMaximize: (id: string) => void
  toggleDesktop: () => void
  reset: () => void
}

function topVisible(windows: WindowStore['windows'], order: string[]) {
  return [...order].reverse().find(id => windows[id] && !windows[id]?.minimized) ?? null
}

export const useWindows = create<WindowStore>((set, get) => ({
  windows: {}, order: [], activeId: null, desktopRestoreIds: [],
  open: (appId, destination) => {
    useShellStore.getState().recordLaunch(appId)
    const state = get()
    const location = destination ?? appLocations[appId]
    if (!location && state.windows[appId]) return state.restore(appId)
    const id = location ? `explorer-${crypto.randomUUID()}` : appId
    const offset = state.order.length * 24
    const record: WindowRecord = {
      id, appId: location ? 'explorer' : appId,
      title: location ? locationName(useFilesStore.getState(), location) : apps[appId].title,
      launchContext: location ? { kind: 'explorer', location } : { kind: 'none' },
      normalRect: visibleRect({ x: 80 + offset, y: 60 + offset, width: 800, height: 520 }),
      mode: 'normal', minimized: false,
    }
    if (location) useExplorerStore.getState().init(id, location)
    set({ windows: { ...state.windows, [id]: record }, order: [...state.order, id], activeId: id, desktopRestoreIds: [] })
  },
  close: id => set(state => {
    const windows = { ...state.windows }
    delete windows[id]
    useExplorerStore.getState().drop(id)
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
  reset: () => { useExplorerStore.setState({ sessions: {}, recent: [] }); set({ windows: {}, order: [], activeId: null, desktopRestoreIds: [] }) },
}))
