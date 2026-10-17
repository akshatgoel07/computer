import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apps, taskbarPinned, type AppId } from '@/lib/apps'
import { useWindows } from '@/stores/windows'
import { useShellStore } from '@/stores/shellStore'
import { useAero } from './aero'
import { iconGlow } from './taskbarGlow'
import StartButton from './StartButton'
import NotificationArea from './NotificationArea'
const TaskbarPreview = lazy(() => import('./TaskbarPreview'))
export default function Taskbar() {
  const windows = useWindows(state => state.windows)
  const order = useWindows(state => state.order)
  const activeId = useWindows(state => state.activeId)
  const epoch = useAero(state => state.epoch)
  const [preview, setPreview] = useState<{ appId: AppId; x: number } | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dismiss = () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current); setPreview(null); useAero.setState({ peek: null }) }
  useEffect(() => { dismiss(); return () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current) } }, [epoch])
  const ids = [...new Set([...taskbarPinned, ...order.flatMap(id => windows[id] ? [windows[id]!.appId] : [])])]
  const leave = () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current); closeTimer.current = setTimeout(dismiss, 300) }
  return <div className="taskbar" role="toolbar" aria-label="Taskbar">
    <StartButton />
    <div className="task-buttons">
      {ids.map(appId => {
        const group = order.filter(id => windows[id]?.appId === appId && !windows[id]?.closing)
        const active = group.includes(activeId ?? '')
        return <button key={appId} className="shell-button task-button" data-app-id={appId} data-window-ids={group.join(' ')} data-running={group.length > 0} data-active={active} data-tooltip={apps[appId].title} aria-label={apps[appId].title}
          onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--x', `${event.clientX - box.x}px`); event.currentTarget.style.setProperty('--y', `${event.clientY - box.y}px`) }}
          onPointerEnter={event => {
            clearTimeout(closeTimer.current); clearTimeout(openTimer.current)
            const button = event.currentTarget
            void iconGlow(apps[appId].icon).then(color => button.style.setProperty('--glow', color))
            if (!group.length) return
            const box = button.getBoundingClientRect()
            openTimer.current = setTimeout(() => setPreview({ appId, x: box.x + box.width / 2 }), 400)
          }} onPointerLeave={leave} onClick={() => {
            dismiss()
            const state = useWindows.getState()
            useShellStore.getState().setStart(false)
            if (!group.length) state.open(appId)
            else if (active && group.length === 1) state.minimize(group[0])
            else if (group.length === 1) state.restore(group[0])
            else { const box = document.querySelector<HTMLElement>(`.task-button[data-app-id="${appId}"]`)!.getBoundingClientRect(); setPreview({ appId, x: box.x + box.width / 2 }) }
          }}>
          <img src={apps[appId].icon} alt="" draggable={false} onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
        </button>
      })}
    </div>
    <NotificationArea />
    {preview && createPortal(<Suspense fallback={null}><TaskbarPreview ids={order.filter(id => windows[id]?.appId === preview.appId)} x={preview.x} enter={() => clearTimeout(closeTimer.current)} leave={leave} dismiss={dismiss} /></Suspense>, document.querySelector('.desktop') ?? document.body)}
  </div>
}
