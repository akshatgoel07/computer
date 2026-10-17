import { useExplorerStore } from '@/stores/explorerStore'
import { useFilesStore } from '@/stores/filesStore'
import { locationName } from '@/fs/paths'
import { apps, taskbarPinned } from '@/lib/apps'
import { useWindows } from '@/stores/windows'
import { useShellStore } from '@/stores/shellStore'
import StartButton from './StartButton'
import NotificationArea from './NotificationArea'

export default function Taskbar({ onPeek }: { onPeek: (peek: boolean) => void }) {
  const windows = useWindows(state => state.windows)
  const order = useWindows(state => state.order)
  const activeId = useWindows(state => state.activeId)
  const sessions = useExplorerStore(state => state.sessions)
  const files = useFilesStore()
  const ids = [...taskbarPinned.map(appId => ({ appId, id: order.find(id => windows[id]?.appId === appId) ?? appId })), ...order.filter(id => !taskbarPinned.some(appId => order.find(item => windows[item]?.appId === appId) === id)).flatMap(id => windows[id] ? [{ appId: windows[id]!.appId, id }] : [])]
  return <div className="taskbar" role="toolbar" aria-label="Taskbar">
    <StartButton />
    <div className="task-buttons">
      {ids.map(({ id, appId }) => <button key={id} className="shell-button task-button" data-app-id={id}
        data-running={Boolean(windows[id])} data-active={activeId === id} title={sessions[id] ? locationName(files, sessions[id].location) : windows[id]?.title ?? apps[appId].title} aria-label={sessions[id] ? locationName(files, sessions[id].location) : windows[id]?.title ?? apps[appId].title}
        onClick={() => {
          const state = useWindows.getState()
          useShellStore.getState().setStart(false)
          if (!windows[id]) state.open(appId)
          else if (activeId === id) state.minimize(id)
          else state.restore(id)
        }}>
        <img src={apps[appId].icon} alt="" draggable={false} onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
      </button>)}
    </div>
    <NotificationArea onPeek={onPeek} />
  </div>
}
