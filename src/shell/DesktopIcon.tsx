import { icons } from '@/assets'
import { apps, type AppId } from '@/lib/apps'
import { useShellStore } from '@/stores/shellStore'
import { useWindows } from '@/stores/windows'

export default function DesktopIcon({ appId }: { appId: AppId }) {
  const selected = useShellStore(state => state.selectedIcon === appId)
  const binCount = useShellStore(state => state.binCount)
  const app = apps[appId]
  return <button className="shell-button desktop-icon" data-selected={selected} aria-pressed={selected}
    onClick={() => useShellStore.getState().selectIcon(appId)}
    onDoubleClick={() => useWindows.getState().open(appId)}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); useWindows.getState().open(appId) }
    }}>
    <img src={appId === 'recycle' && binCount > 0 ? icons.recycleFull : app.icon} alt="" draggable={false}
      onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
    <span>{app.title}</span>
  </button>
}
