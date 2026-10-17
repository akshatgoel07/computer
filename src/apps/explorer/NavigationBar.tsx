import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { icons, sprites } from '@/assets'
import { ancestors, children, itemsAt, locationName, natural, pathFor, resolvePath, sameLocation } from '@/fs/paths'
import { rootId } from '@/fs/seed'
import { type Location } from '@/fs/types'
import { play } from '@/lib/sound'
import { useExplorerStore, type ExplorerSession } from '@/stores/explorerStore'
import { useFilesStore } from '@/stores/filesStore'
import { useFileDialog } from '@/shell/DeleteDialog'
export default function NavigationBar({ windowId, session }: { windowId: string; session: ExplorerSession }) {
  const files = useFilesStore()
  const [edit, setEdit] = useState(false)
  const [path, setPath] = useState('')
  const [menu, setMenu] = useState<number | 'history' | 'overflow' | null>(null)
  const [overflow, setOverflow] = useState(0)
  const address = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const name = locationName(files, session.location)
  const segments: Location[] = session.location.kind === 'folder' ? [{ kind: 'shell', name: 'computer' }, ...ancestors(files, session.location.id).map(node => ({ kind: 'folder' as const, id: node.id }))] : session.location.kind === 'library' ? [{ kind: 'shell', name: 'libraries' }, session.location] : [session.location]
  const segmentKey = JSON.stringify(segments.map(location => [location, locationName(files, location)]))
  useLayoutEffect(() => {
    const element = address.current
    if (!element) return
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return
    context.font = '12px "Segoe UI", Tahoma, sans-serif'
    const widths = segments.map(location => context.measureText(locationName(files, location)).width + 22)
    const update = () => {
      const available = element.clientWidth - 50
      let total = widths.reduce((sum, width) => sum + width, 0)
      let count = 0
      while (count < widths.length - 1 && total + (count ? 18 : 0) > available) { total -= widths[count]; count++ }
      setOverflow(count)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [segmentKey])
  const navigate = (location: Location) => { setMenu(null); setEdit(false); useExplorerStore.getState().navigate(windowId, location) }
  const beginEdit = () => { setPath(session.location.kind === 'folder' ? pathFor(files, session.location.id) : name); setEdit(true) }
  useEffect(() => { if (edit) { input.current?.focus(); input.current?.select() } }, [edit])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'd' && bar.current?.closest('section')?.classList.contains('active') && !useFileDialog.getState().request) { event.preventDefault(); beginEdit() }
    }
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !bar.current?.contains(event.target)) setMenu(null) }
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', outside)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', outside) }
  })
  const resolve = () => {
    const destination = resolvePath(files, path)
    if (destination) navigate(destination)
    else { void play('critical'); useFileDialog.getState().show({ kind: 'error', title: 'Windows Explorer', text: `Windows cannot find '${path}'. Check the spelling and try again.` }) }
  }
  const menuItems = typeof menu === 'number' ? (segments[menu].kind === 'folder' ? children(files, segments[menu].id).filter(node => node.kind === 'folder').map(node => ({ location: { kind: 'folder' as const, id: node.id }, label: node.name })) : itemsAt(files, segments[menu]).flatMap(item => item.location ? [{ location: item.location, label: item.name }] : [])).sort((a, b) => natural(a.label, b.label)) : []
  return <div className="explorer-navigation" ref={bar} onKeyDown={event => {
    if (event.key === 'Escape') { setMenu(null); return }
    if (menu !== null && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault(); event.stopPropagation()
      const buttons = Array.from(bar.current?.querySelectorAll<HTMLButtonElement>('[role=menu] button:not(:disabled)') ?? [])
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[(current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
    }
  }}>
    <button className="shell-button navigation-circle" aria-label="Back" disabled={session.historyIndex === 0} style={{ backgroundImage: `url("${sprites.explorerNavigation}")` }} onClick={() => useExplorerStore.getState().back(windowId)}>‹</button>
    <button className="shell-button navigation-circle forward" aria-label="Forward" disabled={session.historyIndex === session.history.length - 1} style={{ backgroundImage: `url("${sprites.explorerNavigation}")` }} onClick={() => useExplorerStore.getState().forward(windowId)}>›</button>
    <div className="history-wrap"><button className="shell-button history-button" aria-label="Recent pages" aria-expanded={menu === 'history'} onClick={() => setMenu(menu === 'history' ? null : 'history')}>▾</button>{menu === 'history' && <div className="explorer-popup history-popup" role="menu">{session.history.map((location, index) => ({ location, index })).slice(-12).reverse().map(({ location, index }) => <button className="shell-button" role="menuitem" key={index} onClick={() => {
      useExplorerStore.getState().jump(windowId, index)
      setMenu(null)
    }}>{index === session.historyIndex ? '✓ ' : ''}{locationName(files, location)}</button>)}</div>}</div>
    <div ref={address} className="address-field" onClick={event => { if (event.target === event.currentTarget) beginEdit() }}>
      <img className="address-icon" src={icons[session.location.kind === 'folder' && session.location.id === rootId ? 'driveLocal' : 'folder']} alt="" />
      {edit ? <input ref={input} aria-label="Address" value={path} onChange={event => setPath(event.target.value)} onBlur={() => setEdit(false)} onKeyDown={event => { if (event.key === 'Enter') resolve(); if (event.key === 'Escape') setEdit(false) }} /> : <div className="breadcrumbs" onClick={event => { if (event.target === event.currentTarget) beginEdit() }}>{overflow > 0 && <div className="breadcrumb"><button className="shell-button breadcrumb-overflow" aria-label="Previous folders" aria-expanded={menu === 'overflow'} onClick={() => setMenu(menu === 'overflow' ? null : 'overflow')}>»</button>{menu === 'overflow' && <div className="explorer-popup breadcrumb-popup" role="menu">{segments.slice(0, overflow).map(location => <button className="shell-button" role="menuitem" key={JSON.stringify(location)} onClick={() => navigate(location)}>{locationName(files, location)}</button>)}</div>}</div>}{segments.slice(overflow).map((location, offset) => { const index = offset + overflow; return <div className="breadcrumb" key={JSON.stringify(location)}><button className="shell-button breadcrumb-label" onClick={() => navigate(location)}>{locationName(files, location)}</button><button className="shell-button breadcrumb-chevron" aria-label={`Folders in ${locationName(files, location)}`} aria-expanded={menu === index} onClick={() => setMenu(menu === index ? null : index)}><img src={icons.chevronRight} alt="" />›</button>{menu === index && <div className="explorer-popup breadcrumb-popup" role="menu">{menuItems.length ? menuItems.map(item => <button className="shell-button" role="menuitem" key={JSON.stringify(item.location)} style={{ fontWeight: segments[index + 1] && sameLocation(item.location, segments[index + 1]) ? 'bold' : undefined }} onClick={() => navigate(item.location)}>{item.label}</button>) : <button className="shell-button" disabled>(Empty)</button>}</div>}</div> })}</div>}
      <button className="shell-button refresh-button" aria-label="Refresh" onClick={() => useExplorerStore.getState().refresh(windowId)}><img src={icons.refresh} alt="" /></button>
    </div><div className="explorer-search"><input aria-label={`Search ${name}`} placeholder={`Search ${name}`} value={session.query} onChange={event => useExplorerStore.getState().patch(windowId, { query: event.target.value })} /><img src={icons.search} alt="" /></div>
  </div>
}
