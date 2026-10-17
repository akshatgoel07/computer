import { useEffect, useState } from 'react'
import { desktopApps } from '@/lib/apps'
import { useWindows } from '@/stores/windows'
import { useShellStore } from '@/stores/shellStore'
import DesktopIcon from './DesktopIcon'
import WindowFrame from './WindowFrame'
import Taskbar from './Taskbar'
import StartMenu from './StartMenu'
import './shell.css'

export default function Desktop({ enabled }: { enabled: boolean }) {
  const windows = useWindows(state => state.windows)
  const order = useWindows(state => state.order)
  const [peek, setPeek] = useState(false)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!enabled) return
      if (event.key === 'Meta' || event.key === 'OS') {
        event.preventDefault()
        const state = useShellStore.getState()
        state.setStart(!state.startOpen)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [enabled])
  return <main className="win7 desktop" inert={!enabled} aria-label="Desktop">
    <div className="wallpaper" onClick={() => useShellStore.getState().selectIcon(null)} />
    <div className="desktop-icons">{desktopApps.map(id => <DesktopIcon key={id} appId={id} />)}</div>
    {order.map((id, index) => {
      const record = windows[id]
      return record ? <WindowFrame key={id} record={record} zIndex={100 + index} peek={peek} /> : null
    })}
    <Taskbar onPeek={setPeek} />
    <StartMenu />
  </main>
}
