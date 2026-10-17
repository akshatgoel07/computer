import { useEffect, useRef } from 'react'
import { apps } from '@/lib/apps'
import { useWindows } from '@/stores/windows'
import { useExplorerStore } from '@/stores/explorerStore'
import { useFilesStore } from '@/stores/filesStore'
import { locationName } from '@/fs/paths'
import { useAero } from './aero'
import ReadonlyAppView from './ReadonlyAppView'
export default function TaskbarPreview({ ids, x, enter, leave, dismiss }: { ids: string[]; x: number; enter: () => void; leave: () => void; dismiss: () => void }) {
  const windows = useWindows(state => state.windows)
  const sessions = useExplorerStore(state => state.sessions)
  const files = useFilesStore()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { clearTimeout(timer.current); useAero.setState({ peek: null }) }, [])
  const live = ids.filter(id => windows[id] && !windows[id]?.closing)
  if (!live.length) return null
  return <div className="taskbar-previews" role="group" aria-label="Window previews" style={{ left: Math.max(8, Math.min(innerWidth - live.length * 216 - 8, x - live.length * 108)) }} onPointerEnter={enter} onPointerLeave={() => { clearTimeout(timer.current); useAero.setState({ peek: null }); leave() }}>
    {live.map(id => {
      const record = windows[id]!
      const title = sessions[id] ? locationName(files, sessions[id].location) : record.title
      return <div key={id} className="taskbar-thumbnail" onPointerEnter={() => { clearTimeout(timer.current); useAero.setState({ peek: null }); timer.current = setTimeout(() => useAero.setState({ peek: id }), 500) }} onPointerLeave={() => { clearTimeout(timer.current); useAero.setState({ peek: null }) }}>
        <div className="thumbnail-header"><img src={apps[record.appId].icon} alt="" /><span>{title}</span><button className="shell-button thumbnail-close" aria-label={`Close ${title}`} data-tooltip="Close" onClick={() => { clearTimeout(timer.current); useAero.setState({ peek: null }); useWindows.getState().close(id) }}>×</button></div>
        <button className="shell-button thumbnail-target" aria-label={`Activate ${title}`} onClick={() => { useWindows.getState().restore(id); dismiss() }}><ReadonlyAppView windowId={id} /></button>
      </div>
    })}
  </div>
}
