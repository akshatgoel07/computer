import { create } from 'zustand'
import { pinned, type AppId } from '@/lib/apps'
import type { NodeId } from '@/fs/types'
import { readPreference, savePreference } from '@/fs/storage'
import { play } from '@/lib/sound'

export type Session = 'idle' | 'boot' | 'desktop' | 'shutdown' | 'restart' | 'logoff' | 'welcome' | 'locked'
export type PowerAction = 'Switch user' | 'Log off' | 'Lock' | 'Restart' | 'Sleep' | 'Shut down'

type DesktopPreferences = { cells: Record<string, { x: number; y: number }>; size: 'large' | 'medium' | 'small'; align: boolean; auto: boolean; show: boolean; sort: string }
const initialDesktop: DesktopPreferences = { cells: {}, size: 'medium', align: true, auto: false, show: true, sort: 'Name' }
const validDesktop = (value: unknown): value is DesktopPreferences => {
  if (!value || typeof value !== 'object' || !('cells' in value) || !value.cells || typeof value.cells !== 'object') return false
  if (!('size' in value) || !['large', 'medium', 'small'].includes(String(value.size)) || !('align' in value) || typeof value.align !== 'boolean' || !('auto' in value) || typeof value.auto !== 'boolean' || !('show' in value) || typeof value.show !== 'boolean' || !('sort' in value) || typeof value.sort !== 'string') return false
  return Object.values(value.cells).every(cell => cell && typeof cell === 'object' && 'x' in cell && typeof cell.x === 'number' && Number.isFinite(cell.x) && cell.x >= 0 && 'y' in cell && typeof cell.y === 'number' && Number.isFinite(cell.y) && cell.y >= 0)
}
type ShellStore = {
  clipboard: { kind: 'cut' | 'copy'; ids: NodeId[] } | null
  setClipboard: (clipboard: { kind: 'cut' | 'copy'; ids: NodeId[] } | null) => void
  dragIds: NodeId[]
  setDragIds: (ids: NodeId[]) => void
  desktop: DesktopPreferences
  setDesktop: (patch: Partial<DesktopPreferences>) => void
  session: Session
  startOpen: boolean
  selectedIcon: AppId | null
  recent: AppId[]
  setSession: (session: Session) => void
  setStart: (open: boolean) => void
  selectIcon: (id: AppId | null) => void
  recordLaunch: (id: AppId) => void
  power: (action: PowerAction) => void
}

export const useShellStore = create<ShellStore>((set) => ({
  clipboard: null, setClipboard: clipboard => set({ clipboard }),
  dragIds: [], setDragIds: dragIds => set({ dragIds }),
  desktop: readPreference('computer.desktop.v1', initialDesktop, validDesktop),
  setDesktop: patch => set(state => { const desktop = { ...state.desktop, ...patch }; savePreference('computer.desktop.v1', desktop); return { desktop } }),
  session: 'idle', startOpen: false, selectedIcon: null, recent: [],
  setSession: session => set({ session, startOpen: false }),
  setStart: startOpen => set({ startOpen }),
  selectIcon: selectedIcon => set({ selectedIcon }),
  recordLaunch: id => set(state => ({
    startOpen: false,
    recent: pinned.includes(id) ? state.recent : [id, ...state.recent.filter(item => item !== id)].slice(0, 6),
  })),
  power: action => {
    if (action === 'Shut down' || action === 'Restart') {
      void play('shutdown')
      set({ session: action === 'Restart' ? 'restart' : 'shutdown', startOpen: false })
    } else if (action === 'Log off') {
      void play('logoff')
      set({ session: 'logoff', startOpen: false })
    } else set({ session: 'locked', startOpen: false })
  },
}))
