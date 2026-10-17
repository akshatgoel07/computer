import { useCallback, useEffect, useRef, useState } from 'react'
import { children, displayName, natural } from '@/fs/paths'
import { desktopId } from '@/fs/seed'
import { nodeId, type Item } from '@/fs/types'
import { ItemImage } from '@/apps/explorer/FileItem'
import { play } from '@/lib/sound'
import { useWindows } from '@/stores/windows'
import { useFilesStore } from '@/stores/filesStore'
import { useShellStore } from '@/stores/shellStore'
import ContextMenu, { type MenuEntry } from './ContextMenu'
import DeleteDialog, { requestDelete, showError, useFileDialog } from './DeleteDialog'
import DesktopIcon from './DesktopIcon'
import WindowFrame from './WindowFrame'
import Taskbar from './Taskbar'
import StartMenu from './StartMenu'
import './shell.css'
import '@/apps/explorer/explorer.css'
export default function Desktop({ enabled }: { enabled: boolean }) {
  const windows = useWindows(state => state.windows)
  const order = useWindows(state => state.order)
  const files = useFilesStore()
  const preferences = useShellStore(state => state.desktop)
  const modal = useFileDialog(state => Boolean(state.request))
  const [peek, setPeek] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [renameId, setRenameId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight - 40 })
  const [draft, setDraft] = useState<Record<string, { x: number; y: number }>>({})
  const [rectangle, setRectangle] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; x: number; y: number; ids: string[]; positions: Record<string, { x: number; y: number }>; moved: boolean } | null>(null)
  const rubber = useRef<{ x: number; y: number; initial: string[]; ctrl: boolean } | null>(null)
  const suppressClick = useRef(false)
  const anchor = useRef<string | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  useEffect(() => {
    const resize = () => setViewport({ width: innerWidth, height: innerHeight - 40 })
    const key = (event: KeyboardEvent) => {
      if (!enabled || modal) return
      if (event.key === 'Meta' || event.key === 'OS') { event.preventDefault(); const state = useShellStore.getState(); state.setStart(!state.startOpen) }
    }
    window.addEventListener('keydown', key)
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('resize', resize) }
  }, [enabled, modal])
  const width = preferences.size === 'large' ? 112 : preferences.size === 'small' ? 60 : 76
  const height = preferences.size === 'large' ? 136 : preferences.size === 'small' ? 76 : 100
  const rows = Math.max(1, Math.floor(viewport.height / height))
  const items: Item[] = [{ id: 'computer', name: 'Computer', icon: 'computer', location: { kind: 'shell', name: 'computer' } }, { id: 'recycle', name: 'Recycle Bin', icon: Object.keys(files.bin).length ? 'recycleFull' : 'recycleEmpty', location: { kind: 'shell', name: 'bin' } }, ...children(files, desktopId).map(node => ({ id: node.id, name: displayName(node), icon: node.icon, node, location: node.kind === 'folder' ? { kind: 'folder' as const, id: node.id } : undefined }))]
  if (preferences.auto) items.sort((a, b) => natural(a.name, b.name))
  const positions: Record<string, { x: number; y: number }> = {}
  const occupied = new Set<string>()
  for (const [index, item] of items.entries()) {
    let position = preferences.auto ? undefined : preferences.cells[item.id]
    if (!position || position.x > viewport.width - width || position.y > viewport.height - height || occupied.has(`${position.x},${position.y}`)) {
      let cell = index
      do { position = { x: Math.floor(cell / rows) * width, y: cell % rows * height }; cell++ } while (occupied.has(`${position.x},${position.y}`))
    }
    occupied.add(`${position.x},${position.y}`)
    positions[item.id] = position
  }
  const activate = (item: Item) => { if (item.location) useWindows.getState().open('explorer', item.location) }
  const createFolder = () => {
    const result = files.commit({ kind: 'createFolder', parent: desktopId })
    if (!result.ok) { showError(result.error); return }
    if (result.value) { setSelection([result.value]); setRenameId(result.value) }
  }
  const rename = () => {
    const item = items.find(item => item.id === selection[0])
    if (selection.length === 1 && item?.node && !item.node.protected) setRenameId(item.id)
    else void play('ding')
  }
  const remove = (permanent = false) => {
    if (selection.some(id => !files.nodes[nodeId(id)] || files.nodes[nodeId(id)].protected)) { void play('ding'); return }
    requestDelete(selection.map(nodeId), permanent)
  }
  const context = (event: React.MouseEvent, item?: Item) => {
    event.preventDefault(); event.stopPropagation()
    const selected = item && !selection.includes(item.id) ? [item.id] : selection
    if (item) setSelection(selected)
    const change = useShellStore.getState().setDesktop
    const entries: MenuEntry[] = item ? item.id === 'recycle' ? [{ label: 'Open', action: () => activate(item) }, { label: 'Empty Recycle Bin', action: Object.keys(files.bin).length ? () => requestDelete(Object.keys(files.bin).map(nodeId), true, true) : undefined }, { separator: true }, { label: 'Create shortcut' }, { label: 'Rename' }, { separator: true }, { label: 'Properties' }] : [{ label: 'Open', action: () => activate(item) }, { separator: true }, { label: 'Cut' }, { label: 'Copy' }, { label: 'Create shortcut' }, { label: 'Delete', action: item.node && !item.node.protected ? () => requestDelete(selected.map(nodeId)) : undefined }, { label: 'Rename', action: item.node && !item.node.protected && selected.length === 1 ? () => setRenameId(item.id) : undefined }, { separator: true }, { label: 'Properties' }] : [{ label: 'Large icons', action: () => change({ size: 'large' }), checked: preferences.size === 'large' }, { label: 'Medium icons', action: () => change({ size: 'medium' }), checked: preferences.size === 'medium' }, { label: 'Small icons', action: () => change({ size: 'small' }), checked: preferences.size === 'small' }, { separator: true }, { label: 'Auto arrange icons', action: () => change({ auto: !preferences.auto }), checked: preferences.auto }, { label: 'Align icons to grid', action: () => change({ align: !preferences.align }), checked: preferences.align }, { label: 'Show desktop icons', action: () => change({ show: !preferences.show }), checked: preferences.show }, { separator: true }, { label: 'Refresh', action: () => setDraft({}) }, { label: 'Paste' }, { label: 'Paste shortcut' }, { separator: true }, { label: 'New folder', action: createFolder }, { separator: true }, { label: 'Screen resolution' }, { label: 'Gadgets' }, { label: 'Personalize' }]
    setMenu({ x: event.clientX, y: event.clientY, entries })
  }
  return <main className="win7 desktop" inert={!enabled} aria-label="Desktop"><div inert={modal}>
    <div className="wallpaper" />
    <div ref={grid} className="desktop-grid" tabIndex={0} aria-label="Desktop files" onContextMenu={event => context(event)} onKeyDown={event => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'Enter') { event.preventDefault(); for (const item of items.filter(item => selection.includes(item.id))) activate(item) }
      else if (event.key === 'F2') { event.preventDefault(); rename() }
      else if (event.key === 'Delete') { event.preventDefault(); remove(event.shiftKey) }
      else if (event.key === 'F5') { event.preventDefault(); setDraft({}) }
      else if (event.ctrlKey && event.key.toLowerCase() === 'a') { event.preventDefault(); setSelection(items.map(item => item.id)) }
      else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); createFolder() }
      else if (event.key === 'Escape') { setMenu(null); drag.current = null; rubber.current = null; setDraft({}); setRectangle(null) }
      else if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); const item = items.find(item => item.id === selection[0]); const point = item ? positions[item.id] : { x: 0, y: 0 }; context({ preventDefault() {}, stopPropagation() {}, clientX: point.x + 20, clientY: point.y + 30 } as React.MouseEvent, item) }
      else if (event.key.startsWith('Arrow')) { event.preventDefault(); const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest('[data-item-id]')?.getAttribute('data-item-id') : null; const index = Math.max(0, items.findIndex(item => item.id === (focused ?? selection.at(-1)))); const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'ArrowRight' ? rows : -rows; const item = items[Math.max(0, Math.min(items.length - 1, index + delta))]; if (item) { grid.current?.querySelector<HTMLElement>(`[data-item-id="${item.id}"]`)?.focus(); if (!event.ctrlKey) { const a = Math.max(0, items.findIndex(value => value.id === anchor.current)); const b = items.findIndex(value => value.id === item.id); setSelection(event.shiftKey ? items.slice(Math.min(a, b), Math.max(a, b) + 1).map(value => value.id) : [item.id]); if (!event.shiftKey) anchor.current = item.id } } }
    }} onPointerDown={event => {
      if (event.button !== 0 || event.target !== event.currentTarget) return
      grid.current?.focus(); setSelection(event.ctrlKey ? selection : []); useShellStore.getState().setStart(false)
      rubber.current = { x: event.clientX, y: event.clientY, initial: [...selection], ctrl: event.ctrlKey }
      event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerMove={event => {
      const start = drag.current
      if (start) {
        const dx = event.clientX - start.x; const dy = event.clientY - start.y
        if (!start.moved && Math.hypot(dx, dy) < 4) return
        if (!start.moved) setSelection(start.ids)
        start.moved = true
        setDraft(Object.fromEntries(start.ids.map(id => [id, { x: Math.max(0, Math.min(viewport.width - width, start.positions[id].x + dx)), y: Math.max(0, Math.min(viewport.height - height, start.positions[id].y + dy)) }])))
      }
      const begin = rubber.current
      if (begin && Math.hypot(event.clientX - begin.x, event.clientY - begin.y) >= 4) {
        const rectangle = { x: Math.min(begin.x, event.clientX), y: Math.min(begin.y, event.clientY), width: Math.abs(event.clientX - begin.x), height: Math.abs(event.clientY - begin.y) }
        setRectangle(rectangle)
        const ids = items.filter(item => { const p = positions[item.id]; return p.x < rectangle.x + rectangle.width && p.x + width > rectangle.x && p.y < rectangle.y + rectangle.height && p.y + height > rectangle.y }).map(item => item.id)
        setSelection(begin.ctrl ? [...begin.initial.filter(id => !ids.includes(id)), ...ids.filter(id => !begin.initial.includes(id))] : ids)
      }
    }} onPointerUp={event => {
      const start = drag.current
      if (start?.moved) {
        suppressClick.current = true
        const target = items.find(item => !start.ids.includes(item.id) && event.clientX >= positions[item.id].x && event.clientX < positions[item.id].x + width && event.clientY >= positions[item.id].y && event.clientY < positions[item.id].y + height)
        if (target?.id === 'recycle') requestDelete(start.ids.flatMap(id => files.nodes[nodeId(id)] ? [nodeId(id)] : []))
        else {
          const cells = { ...preferences.cells }
          const used = new Set(items.filter(item => !start.ids.includes(item.id)).map(item => `${positions[item.id].x},${positions[item.id].y}`))
          for (const id of start.ids) {
            const point = draft[id] ?? positions[id]
            const ideal = preferences.align ? { x: Math.round(point.x / width) * width, y: Math.round(point.y / height) * height } : point
            const choices = Array.from({ length: Math.max(1, Math.floor(viewport.width / width)) * rows }, (_, index) => ({ x: Math.floor(index / rows) * width, y: index % rows * height })).filter(p => !used.has(`${p.x},${p.y}`)).sort((a, b) => ((a.x - ideal.x) ** 2 + (a.y - ideal.y) ** 2) - ((b.x - ideal.x) ** 2 + (b.y - ideal.y) ** 2) || a.x - b.x || a.y - b.y)
            const final = !preferences.align && !used.has(`${ideal.x},${ideal.y}`) ? ideal : choices[0] ?? ideal
            cells[id] = final; used.add(`${final.x},${final.y}`)
          }
          useShellStore.getState().setDesktop({ cells, auto: false })
        }
      }
      drag.current = null; rubber.current = null; setRectangle(null); setDraft({})
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }} onPointerCancel={() => { drag.current = null; rubber.current = null; setRectangle(null); setDraft({}) }}>
      {preferences.show && items.map(item => <DesktopIcon key={item.id} item={item} selected={selection.includes(item.id)} position={positions[item.id]} size={preferences.size} rename={renameId === item.id} finishRename={() => { setRenameId(null); grid.current?.focus() }} dragging={false} onClick={event => {
        if (suppressClick.current) { suppressClick.current = false; return }
        const a = Math.max(0, items.findIndex(value => value.id === anchor.current)); const b = items.findIndex(value => value.id === item.id)
        setSelection(event.shiftKey ? [...new Set([...(event.ctrlKey ? selection : []), ...items.slice(Math.min(a, b), Math.max(a, b) + 1).map(value => value.id)])] : event.ctrlKey || event.metaKey ? selection.includes(item.id) ? selection.filter(id => id !== item.id) : [...selection, item.id] : [item.id])
        if (!event.shiftKey) anchor.current = item.id
      }} onDoubleClick={() => activate(item)} onContextMenu={event => context(event, item)} onPointerDown={event => {
        if (event.button !== 0 || renameId || event.target instanceof HTMLInputElement) return
        const ids = selection.includes(item.id) ? selection : [item.id]
        drag.current = { id: item.id, x: event.clientX, y: event.clientY, ids, positions, moved: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      }} />)}{items.filter(item => draft[item.id]).map(item => <div className="desktop-drag-image" key={`drag-${item.id}`} style={{ left: draft[item.id].x, top: draft[item.id].y, width, height }}><div style={{ width: preferences.size === 'large' ? 96 : preferences.size === 'small' ? 32 : 48, height: preferences.size === 'large' ? 96 : preferences.size === 'small' ? 32 : 48, margin: '8px auto 3px' }}><ItemImage item={item} /></div><span>{item.name}</span></div>)}{rectangle && <div className="rubber-band" style={{ left: rectangle.x, top: rectangle.y, width: rectangle.width, height: rectangle.height }} />}
    </div>
    {order.map((id, index) => { const record = windows[id]; return record ? <WindowFrame key={id} record={record} zIndex={100 + index} peek={peek} /> : null })}
    <Taskbar onPeek={setPeek} /><StartMenu />{menu && <ContextMenu {...menu} close={closeMenu} />}
  </div><DeleteDialog /></main>
}
