import { create } from 'zustand'
import { inBin, parentLocation, sameLocation } from '@/fs/paths'
import { play } from '@/lib/sound'
import { readPreference, savePreference } from '@/fs/storage'
import { type Location, type NodeId, type View } from '@/fs/types'
import { useFilesStore } from '@/stores/filesStore'
export type ExplorerSession = { location: Location; history: Location[]; historyIndex: number; selection: string[]; anchor: string | null; view: View; sort: { field: string; descending: boolean }; query: string }
const validViews = (value: unknown): value is Record<string, View> => typeof value === 'object' && value !== null && Object.values(value).every(view => ['extraLarge', 'large', 'medium', 'small', 'list', 'details', 'tiles', 'content'].includes(view))
const preferences = readPreference('computer.explorer.v1', {}, validViews)
const defaultView = (location: Location): View => {
  if (location.kind === 'library') return ['pictures', 'videos'].includes(location.library) ? 'large' : 'details'
  if (location.kind === 'folder') {
    const node = useFilesStore.getState().nodes[location.id]
    if (node?.kind === 'folder' && ['pictures', 'videos'].includes(node.template)) return 'large'
    return location.id === 'akshat' ? 'tiles' : 'details'
  }
  return ['libraries', 'computer'].includes(location.name) ? 'tiles' : 'details'
}
const viewAt = (location: Location) => preferences[JSON.stringify(location)] ?? defaultView(location)
type ExplorerStore = { sessions: Record<string, ExplorerSession>; recent: NodeId[]; init: (id: string, location: Location) => void; drop: (id: string) => void; navigate: (id: string, location: Location) => void; back: (id: string) => void; forward: (id: string) => void; jump: (id: string, index: number) => void; up: (id: string) => void; patch: (id: string, patch: Partial<ExplorerSession>) => void; refresh: (id: string) => void }
export const useExplorerStore = create<ExplorerStore>((set, get) => {
  const travel = (id: string, index: number) => {
    const session = get().sessions[id]
    const destination = session?.history[index]
    if (!session || !destination || index === session.historyIndex) return
    const files = useFilesStore.getState()
    if (destination.kind === 'folder' && (!files.nodes[destination.id] || inBin(files, destination.id))) return
    get().patch(id, { location: destination, historyIndex: index, selection: [], anchor: null, query: '', view: viewAt(destination) })
    if (!sameLocation(session.location, destination)) void play('navigation')
  }
  return {
    sessions: {}, recent: [],
    init: (id, location) => set(state => state.sessions[id] ? state : { sessions: { ...state.sessions, [id]: { location, history: [location], historyIndex: 0, selection: [], anchor: null, view: viewAt(location), sort: { field: 'Name', descending: false }, query: '' } } }),
    drop: id => set(state => { const sessions = { ...state.sessions }; delete sessions[id]; return { sessions } }),
    patch: (id, patch) => set(state => {
      const session = state.sessions[id]
      if (!session) return state
      if (patch.view) { preferences[JSON.stringify(session.location)] = patch.view; savePreference('computer.explorer.v1', preferences) }
      return { sessions: { ...state.sessions, [id]: { ...session, ...patch } } }
    }),
    navigate: (id, location) => {
      const session = get().sessions[id]
      if (!session || sameLocation(session.location, location)) return
      const files = useFilesStore.getState()
      if (location.kind === 'folder' && (!files.nodes[location.id] || inBin(files, location.id))) return
      const history = [...session.history.slice(0, session.historyIndex + 1), location]
      get().patch(id, { location, history, historyIndex: history.length - 1, selection: [], anchor: null, query: '', view: viewAt(location) })
      if (location.kind === 'folder') set(state => ({ recent: [location.id, ...state.recent.filter(item => item !== location.id)].slice(0, 10) }))
      void play('navigation')
    },
    jump: travel,
    back: id => { const session = get().sessions[id]; if (session) travel(id, session.historyIndex - 1) },
    forward: id => { const session = get().sessions[id]; if (session) travel(id, session.historyIndex + 1) },
    up: id => { const session = get().sessions[id]; if (!session) return; const parent = parentLocation(useFilesStore.getState(), session.location); if (parent) get().navigate(id, parent) },
    refresh: id => { const session = get().sessions[id]; if (session) get().patch(id, { selection: session.selection.filter(item => Boolean(useFilesStore.getState().nodes[item as NodeId])) }) },
  }
})
