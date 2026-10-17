import { apps, taskbarPinned } from '@/lib/apps'
import { useWindows } from '@/stores/windows'
import { useShellStore } from '@/stores/shellStore'
import StartButton from './StartButton'
import NotificationArea from './NotificationArea'

export default function Taskbar({ onPeek }: { onPeek: (peek: boolean) => void }) {
  const windows = useWindows(state => state.windows)
  const order = useWindows(state => state.order)
  const activeId = useWindows(state => state.activeId)
  const ids = [...taskbarPinned, ...order.filter(id => !taskbarPinned.includes(id))]
  return <div className="taskbar" role="toolbar" aria-label="Taskbar">
    <StartButton />
    <div className="task-buttons">
      {ids.map(id => <button key={id} className="shell-button task-button" data-app-id={id}
        data-running={Boolean(windows[id])} data-active={activeId === id} title={apps[id].title} aria-label={apps[id].title}
        onClick={() => {
          const state = useWindows.getState()
          useShellStore.getState().setStart(false)
          if (!windows[id]) state.open(id)
          else if (activeId === id) state.minimize(id)
          else state.restore(id)
        }}>
        <img src={apps[id].icon} alt="" draggable={false} onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
      </button>)}
    </div>
    <NotificationArea onPeek={onPeek} />
  </div>
}
