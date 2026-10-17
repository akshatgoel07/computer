import { useEffect, useRef, useState } from 'react'
import { cancelPreviews, duration } from './aero'
import { images } from '@/assets'
import { appIds, apps, destinations, pinned, type AppId } from '@/lib/apps'
import { useShellStore, type PowerAction } from '@/stores/shellStore'
import { useWindows } from '@/stores/windows'

const powerActions: PowerAction[] = ['Switch user', 'Log off', 'Lock', 'Restart', 'Sleep', 'Shut down']

export default function StartMenu() {
  const open = useShellStore(state => state.startOpen)
  const recent = useShellStore(state => state.recent)
  const [mounted, setMounted] = useState(open)
  const [search, setSearch] = useState('')
  const [allPrograms, setAllPrograms] = useState(false)
  const [powerOpen, setPowerOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      cancelPreviews()
      setMounted(true)
      setSearch('')
      setAllPrograms(false)
      setPowerOpen(false)
      const timer = setTimeout(() => input.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setMounted(false), duration(100))
    return () => clearTimeout(timer)
  }, [open])
  useEffect(() => {
    if (!open) return
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !document.getElementById('start-button')?.contains(event.target)) {
        useShellStore.getState().setStart(false)
      }
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        useShellStore.getState().setStart(false)
        document.getElementById('start-button')?.focus()
      }
    }
    window.addEventListener('pointerdown', pointer)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', pointer); window.removeEventListener('keydown', key) }
  }, [open])
  useEffect(() => { if (open && mounted) input.current?.focus() }, [open, mounted])
  if (!mounted) return null
  const results = search ? appIds.filter(id => apps[id].title.toLowerCase().includes(search.toLowerCase())) : allPrograms ? appIds : recent
  const launch = (id: AppId) => useWindows.getState().open(id)
  const entry = (id: AppId) => <button className="shell-button entry" key={id} onClick={() => launch(id)}>
    <img src={apps[id].icon} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden' }} /><span>{apps[id].title}</span>
  </button>
  return <div ref={menu} id="start-menu" className="start-menu" data-open={open} aria-label="Start menu" inert={!open}>
    <div className="start-left">
      <div className="start-pinned">{pinned.map(entry)}</div>
      <div className="start-separator" />
      <div className="start-recent">{results.map(entry)}{search && results.length === 0 && <p>No items match your search.</p>}</div>
      <button className="shell-button entry all-programs" onClick={() => { setAllPrograms(!allPrograms); setSearch('') }}>
        <span className={`program-triangle${allPrograms ? ' back' : ''}`} />{allPrograms ? 'Back' : 'All Programs'}
      </button>
      <div className="search-footer"><div className="search-box">
        <input ref={input} aria-label="Search programs and files" placeholder="Search programs and files" value={search} onChange={event => setSearch(event.target.value)} />
        <span className="search-glyph" aria-hidden="true" />
      </div></div>
    </div>
    <div className="start-right">
      <div className="user-tile"><img src={images.userTile} alt="Akshat" onError={event => { event.currentTarget.style.visibility = 'hidden' }} /></div>
      {destinations.map((id, index) => <button className="shell-button entry destination" key={id}
        style={{ top: index < 5 ? 38 + index * 30 : 198 + (index - 5) * 30 }}
        data-compact={id === 'devices'} onClick={() => launch(id)}>{apps[id].title}</button>)}
      <div className="right-separator first" /><div className="right-separator second" />
      <button className="shell-button shutdown" onClick={() => useShellStore.getState().power('Shut down')}>Shut down</button>
      <button className="shell-button shutdown shutdown-arrow" aria-label="Shutdown options" aria-expanded={powerOpen} onClick={() => setPowerOpen(!powerOpen)}><span /></button>
      {powerOpen && <div className="power-popup">{powerActions.map(action => <button className="shell-button entry" key={action}
        onClick={() => useShellStore.getState().power(action)}>{action}</button>)}</div>}
    </div>
  </div>
}
