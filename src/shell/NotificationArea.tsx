import { useEffect, useRef, useState } from 'react'
import { useAero } from './aero'
import { useWindows } from '@/stores/windows'

export default function NotificationArea() {
  const epoch = useAero(state => state.epoch)
  const [now, setNow] = useState(() => new Date())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => { clearInterval(interval); clearTimeout(timer.current) }
  }, [])
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
  const endPeek = () => { clearTimeout(timer.current); useAero.setState({ peek: null }) }
  useEffect(() => { endPeek() }, [epoch])
  return <>
    <div className="notification-area">
      <button className="shell-button tray-button" title="Show hidden icons" aria-label="Show hidden icons"><span className="tray-arrow" /></button>
      <button className="shell-button tray-button" title="Action Center" aria-label="Action Center">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 14V2m1 1c3-3 6 3 10 0v7c-4 3-7-3-10 0" /></svg>
      </button>
      <button className="shell-button tray-button" title="Network" aria-label="Network">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 2h12v8H1zm6 8v3m-3 0h6m3-6h2v7h-5v-3" /></svg>
      </button>
      <button className="shell-button tray-button" title="Speakers" aria-label="Speakers">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-4v12l-4-4H2zm9-1c2 1 2 5 0 6m2-8c3 2 3 8 0 10" /></svg>
      </button>
      <div className="taskbar-clock" title={now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}>
        <div>{time}</div><div>{date}</div>
      </div>
    </div>
    <button className="shell-button show-desktop" title="Show desktop" aria-label="Show desktop"
      onPointerEnter={() => { timer.current = setTimeout(() => useAero.setState({ peek: 'desktop' }), 1000) }}
      onPointerLeave={endPeek} onClick={() => { endPeek(); useWindows.getState().toggleDesktop() }} />
  </>
}
