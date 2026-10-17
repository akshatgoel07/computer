import { create } from 'zustand'
import { pinned, type AppId } from '@/lib/apps'
import { play } from '@/lib/sound'

export type Session = 'idle' | 'boot' | 'desktop' | 'shutdown' | 'restart' | 'logoff' | 'welcome' | 'locked'
export type PowerAction = 'Switch user' | 'Log off' | 'Lock' | 'Restart' | 'Sleep' | 'Shut down'

type ShellStore = {
  session: Session
  startOpen: boolean
  selectedIcon: AppId | null
  recent: AppId[]
  binCount: number
  setSession: (session: Session) => void
  setStart: (open: boolean) => void
  selectIcon: (id: AppId | null) => void
  recordLaunch: (id: AppId) => void
  power: (action: PowerAction) => void
}

export const useShellStore = create<ShellStore>((set) => ({
  session: 'idle', startOpen: false, selectedIcon: null, recent: [], binCount: 0,
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
