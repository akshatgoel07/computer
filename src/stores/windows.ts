import { transition, type WindowMode, type WindowTransition } from '@/shell/aero'
import { create } from 'zustand'
import { apps, appSizes, appLocations, type AppId } from '@/lib/apps'
import { useShellStore } from '@/stores/shellStore'
import type { Location, NodeId } from '@/fs/types'
import { useExplorerStore } from '@/stores/explorerStore'
import { displayName, locationName } from '@/fs/paths'
import { useFilesStore } from '@/stores/filesStore'
import { visibleRect, type Rect } from '@/lib/windowGeometry'

export type LaunchContext = { kind: 'explorer'; location: Location } | { kind: 'file'; id: NodeId } | { kind: 'photo'; id: NodeId; ids: NodeId[]; slideShow: boolean } | { kind: 'audio'; selected: NodeId | null; ids: NodeId[]; play: boolean } | { kind: 'none' }
const closeGuards = new Map<string, () => boolean>()
export function registerCloseGuard(id: string, guard: () => boolean) { closeGuards.set(id, guard); return () => { closeGuards.delete(id) } }
export type WindowRecord = {
  id: string
  appId: AppId
  title: string
  launchContext: LaunchContext
  normalRect: Rect
  mode: WindowMode
  transition: WindowTransition
  closing: boolean
  minimized: boolean
}

type WindowStore = {
  windows: Partial<Record<string, WindowRecord>>
  order: string[]
  activeId: string | null
  desktopRestoreIds: string[]
  open: (appId: AppId, location?: Location, context?: LaunchContext) => void
  close: (id: string, force?: boolean) => void
  finishClose: (id: string) => void
  geometry: (id: string, mode: WindowMode, from?: Rect) => void
  shake: (id: string) => void
  shakeOwner: string | null
  shakeIds: string[]
  setTitle: (id: string, title: string) => void
  setContext: (id: string, context: LaunchContext) => void
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
  return [...order].reverse().find(id => windows[id] && !windows[id]?.minimized && !windows[id]?.closing) ?? null
}

export const useWindows = create<WindowStore>((set, get) => ({
  windows: {}, order: [], activeId: null, desktopRestoreIds: [], shakeOwner: null, shakeIds: [],
  open: (appId, destination, context) => {
    useShellStore.getState().recordLaunch(appId)
    const state = get()
    const location = destination ?? appLocations[appId]
    const existingFile = context?.kind === 'file' || context?.kind === 'photo' ? Object.values(state.windows).find(record => record?.appId === appId && (record.launchContext.kind === 'file' || record.launchContext.kind === 'photo') && record.launchContext.id === context.id)?.id : undefined
    const id = location ? `explorer-${crypto.randomUUID()}` : context?.kind === 'file' || context?.kind === 'photo' ? existingFile ?? `${appId}-${crypto.randomUUID()}` : appId
    const existing = state.windows[id]
    if (existing) {
      if (context?.kind === 'audio' && (existing.launchContext.kind !== 'audio' || existing.launchContext.selected !== context.selected || context.play)) get().setContext(id, context)
      if (context?.kind === 'photo' && context.slideShow) get().setContext(id, context)
      return state.restore(id)
    }
    const size = appSizes[location ? 'explorer' : appId] ?? { width: 800, height: 520, minWidth: 320, minHeight: 200 }
    const offset = state.order.length * 24
    const record: WindowRecord = {
      id, appId: location ? 'explorer' : appId,
      title: location ? locationName(useFilesStore.getState(), location) : context?.kind === 'file' ? `${useFilesStore.getState().nodes[context.id]?.name ?? 'Untitled'} - Notepad` : context?.kind === 'photo' ? `${useFilesStore.getState().nodes[context.id] ? displayName(useFilesStore.getState().nodes[context.id]) : ''} - Windows Photo Viewer` : appId === 'notepad' ? 'Untitled - Notepad' : apps[appId].title,
      launchContext: location ? { kind: 'explorer', location } : context ?? { kind: 'none' },
      normalRect: visibleRect({ x: 80 + offset, y: 60 + offset, width: size.width, height: size.height }, undefined, { width: size.minWidth, height: size.minHeight }),
      mode: 'normal', minimized: false, closing: false, transition: transition('open'),
    }
    if (location) useExplorerStore.getState().init(id, location)
    set({ windows: { ...state.windows, [id]: record }, order: [...state.order, id], activeId: id, desktopRestoreIds: [] })
  },
  setTitle: (id, title) => set(state => { const record = state.windows[id]; return record && record.title !== title ? { windows: { ...state.windows, [id]: { ...record, title } } } : state }),
  setContext: (id, launchContext) => set(state => { const record = state.windows[id]; return record ? { windows: { ...state.windows, [id]: { ...record, launchContext } } } : state }),
  close: (id, force = false) => {
    if (!force && closeGuards.get(id)?.() === false) return
    set(state => { const record = state.windows[id]; if (!record || record.closing) return state; const windows = { ...state.windows, [id]: { ...record, closing: true, transition: transition('close') } }; return { windows, activeId: topVisible(windows, state.order) } })
  },
  finishClose: id => {
    closeGuards.delete(id)
    set(state => {
    const windows = { ...state.windows }
    delete windows[id]
    useExplorerStore.getState().drop(id)
    const order = state.order.filter(item => item !== id)
    return { windows, order, activeId: topVisible(windows, order), desktopRestoreIds: state.desktopRestoreIds.filter(item => item !== id) }
  })
  },
  focus: id => set(state => !state.windows[id] || state.windows[id]?.minimized ? state : ({
    order: [...state.order.filter(item => item !== id), id], activeId: id,
  })),
  minimize: id => set(state => {
    const record = state.windows[id]
    if (!record) return state
    const windows = { ...state.windows, [id]: { ...record, minimized: true, transition: transition('minimize') } }
    return { windows, activeId: topVisible(windows, state.order) }
  }),
  maximize: id => set(state => {
    const record = state.windows[id]
    return record ? { windows: { ...state.windows, [id]: { ...record, mode: 'maximized', minimized: false, transition: transition('geometry') } }, activeId: id, order: [...state.order.filter(item => item !== id), id] } : state
  }),
  restore: id => set(state => {
    const record = state.windows[id]
    return record ? { windows: { ...state.windows, [id]: { ...record, minimized: false, transition: record.minimized ? transition('restore') : record.transition } }, activeId: id, order: [...state.order.filter(item => item !== id), id] } : state
  }),
  move: (id, normalRect) => set(state => {
    const record = state.windows[id]
    return record ? { windows: { ...state.windows, [id]: { ...record, mode: 'normal', normalRect: visibleRect(normalRect, undefined, { width: appSizes[record.appId]?.minWidth ?? 320, height: appSizes[record.appId]?.minHeight ?? 200 }) } } } : state
  }),
  geometry: (id, mode, from) => set(state => {
    const record = state.windows[id]
    return record ? { windows: { ...state.windows, [id]: { ...record, mode, transition: transition('geometry', from) } } } : state
  }),
  toggleMaximize: id => { const record = get().windows[id]; if (record) get().geometry(id, record.mode === 'normal' ? 'maximized' : 'normal') },
  shake: id => set(state => {
    const restore = state.shakeOwner === id && state.shakeIds.length > 0
    const ids = restore ? state.shakeIds : state.order.filter(other => other !== id && !state.windows[other]?.minimized && !state.windows[other]?.closing)
    const windows = { ...state.windows }
    for (const other of ids) { const record = windows[other]; if (record) windows[other] = { ...record, minimized: !restore, transition: transition(restore ? 'restore' : 'minimize') } }
    return { windows, shakeOwner: restore ? null : id, shakeIds: restore ? [] : ids, activeId: id }
  }),
  toggleDesktop: () => set(state => {
    const restore = state.desktopRestoreIds.length > 0
    const ids = restore ? state.desktopRestoreIds : state.order.filter(id => !state.windows[id]?.minimized)
    const windows = { ...state.windows }
    for (const id of ids) {
      const record = windows[id]
      if (record) windows[id] = { ...record, minimized: !restore, transition: transition(restore ? 'restore' : 'minimize') }
    }
    return { windows, desktopRestoreIds: restore ? [] : ids, activeId: topVisible(windows, state.order) }
  }),
  reset: () => { closeGuards.clear(); useExplorerStore.setState({ sessions: {}, recent: [] }); set({ windows: {}, order: [], activeId: null, desktopRestoreIds: [], shakeOwner: null, shakeIds: [] }) },
}))
