import { useCallback, useEffect, useRef, useState } from 'react'
import { children, displayName, natural, typeName, writableParent } from '@/fs/paths'
import { desktopId } from '@/fs/seed'
import { nodeId, type Item } from '@/fs/types'
import { ItemImage } from '@/apps/explorer/FileItem'
import { blankMenu, itemMenu, sortMenu } from '@/shell/fileMenus'
import { canPaste, openNode, paste, setClipboard } from '@/lib/fileActions'
import { play } from '@/lib/sound'
import { useExplorerStore } from '@/stores/explorerStore'
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
  const clipboard = useShellStore(state => state.clipboard)
  const preferences = useShellStore(state => state.desktop)
  const localModal = useShellStore(state => state.modalCount > 0)
  const globalModal = useFileDialog(state => Boolean(state.request))
  const modal = globalModal || localModal
  const [peek, setPeek] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [renameId, setRenameId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[]; width?: number } | null>(null)
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
  useEffect(() => {
    if (modal || !enabled) return
    const frame = requestAnimationFrame(() => {
      const id = useWindows.getState().activeId
      if (!id) return
      const owner = document.querySelector<HTMLElement>(`.shell-window[data-window-id="${id}"]`)
      const target = owner?.querySelector<HTMLElement>('[data-app-focus]') ?? owner
      target?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [modal, enabled])
  const width = preferences.size === 'large' ? 112 : preferences.size === 'small' ? 60 : 76
  const height = preferences.size === 'large' ? 136 : preferences.size === 'small' ? 76 : 100
  const rows = Math.max(1, Math.floor(viewport.height / height))
  const items: Item[] = [{ id: 'computer', name: 'Computer', icon: 'computer', location: { kind: 'shell', name: 'computer' } }, { id: 'recycle', name: 'Recycle Bin', icon: Object.keys(files.bin).length ? 'recycleFull' : 'recycleEmpty', location: { kind: 'shell', name: 'bin' } }, ...children(files, desktopId).map(node => ({ id: node.id, name: displayName(node), icon: node.icon, node, location: node.kind === 'folder' ? { kind: 'folder' as const, id: node.id } : undefined }))]
  if (preferences.auto) items.splice(2, items.length - 2, ...items.slice(2).sort((a, b) => preferences.sort === 'Size' ? (a.node?.kind === 'file' ? a.node.bytes : 0) - (b.node?.kind === 'file' ? b.node.bytes : 0) : preferences.sort === 'Date modified' ? (a.node?.modifiedAt ?? 0) - (b.node?.modifiedAt ?? 0) : preferences.sort === 'Item type' ? natural(a.node ? typeName(a.node) : '', b.node ? typeName(b.node) : '') : natural(a.name, b.name)))
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
  const activate = (item: Item) => { if (item.location) useWindows.getState().open('explorer', item.location); else if (item.node) openNode(item.node.id) }
  const createFolder = () => {
    const result = files.commit({ kind: 'createFolder', parent: desktopId })
    if (!result.ok) { showError(result.error); return }
    if (result.value) { setSelection([result.value]); anchor.current = result.value; setRenameId(result.value) }
  }
  const createText = () => {
    const result = files.commit({ kind: 'createText', parent: desktopId })
    if (!result.ok) { showError(result.error); return }
    if (result.value) { setSelection([result.value]); anchor.current = result.value; setRenameId(result.value) }
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
    const selectedItems = items.filter(item => selected.includes(item.id))
    const view: MenuEntry[] = ([['Large icons', 'large'], ['Medium icons', 'medium'], ['Small icons', 'small']] as const).map(([label, size]) => ({ label, checked: preferences.size === size, action: () => change({ size }) }))
    view.push({ separator: true }, { label: 'Auto arrange icons', checked: preferences.auto, action: () => change({ auto: !preferences.auto }) }, { label: 'Align icons to grid', checked: preferences.align, action: () => change({ align: !preferences.align }) }, { separator: true }, { label: 'Show desktop icons', checked: preferences.show, action: () => change({ show: !preferences.show }) }, { label: 'Show desktop gadgets', checked: preferences.gadgets ?? true, action: () => change({ gadgets: !(preferences.gadgets ?? true) }) })
    const entries = item ? itemMenu({ item, selected: selectedItems, parent: desktopId, bin: false, open: () => activate(item), openWindow: () => { const payload = item.node?.kind === 'file' ? item.node.payload : null; const target = payload?.kind === 'shortcut' && (payload.target.kind === 'file' || payload.target.kind === 'folder') ? files.nodes[payload.target.id]?.parentId : null; if (target) useWindows.getState().open('explorer', { kind: 'folder', id: target }); else if (item.location) useWindows.getState().open('explorer', item.location) }, rename: () => setRenameId(item.id), remove: () => requestDelete(selected.map(nodeId)) }) : blankMenu({ desktop: true, view, sort: sortMenu(preferences.sort, sort => { const sorted = [...items.slice(0, 2), ...items.slice(2).sort((a, b) => sort === 'Size' ? (a.node?.kind === 'file' ? a.node.bytes : 0) - (b.node?.kind === 'file' ? b.node.bytes : 0) : sort === 'Date modified' ? (a.node?.modifiedAt ?? 0) - (b.node?.modifiedAt ?? 0) : sort === 'Item type' ? natural(a.node ? typeName(a.node) : '', b.node ? typeName(b.node) : '') : natural(a.name, b.name))]; change({ sort, cells: Object.fromEntries(sorted.map((item, index) => [item.id, { x: Math.floor(index / rows) * width, y: index % rows * height }])) }) }), refresh: () => setDraft({}), parent: desktopId, folder: createFolder, text: createText })
    setMenu({ x: event.clientX, y: event.clientY, entries, width: item ? 256 : 208 })
  }
  return <main className="win7 desktop" inert={!enabled} aria-label="Desktop"><div inert={modal}>
    <div className="wallpaper" />
    <div ref={grid} className="desktop-grid" tabIndex={0} aria-label="Desktop files" onContextMenu={event => context(event)} onKeyDown={event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.ctrlKey && ['c', 'x', 'v'].includes(event.key.toLowerCase())) { event.preventDefault(); const key = event.key.toLowerCase(); if (key === 'v') { if (canPaste()) paste(desktopId) } else setClipboard(key === 'x' ? 'cut' : 'copy', selection.filter(id => Boolean(files.nodes[nodeId(id)])).map(nodeId)); return }
      if (event.key === 'Enter') { event.preventDefault(); for (const item of items.filter(item => selection.includes(item.id))) activate(item) }
      else if (event.key === 'F2') { event.preventDefault(); rename() }
      else if (event.key === 'Delete') { event.preventDefault(); remove(event.shiftKey) }
      else if (event.key === 'F5') { event.preventDefault(); setDraft({}) }
      else if (event.ctrlKey && event.key.toLowerCase() === 'a') { event.preventDefault(); setSelection(items.map(item => item.id)) }
      else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); createFolder() }
      else if (event.key === 'Escape') { if (clipboard?.kind === 'cut') useShellStore.getState().setClipboard(null); setMenu(null); drag.current = null; rubber.current = null; setDraft({}); setRectangle(null) }
      else if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); const item = items.find(item => item.id === selection[0]); const point = item ? positions[item.id] : { x: 0, y: 0 }; context({ preventDefault() {}, stopPropagation() {}, clientX: point.x + 20, clientY: point.y + 30 } as React.MouseEvent, item) }
      else if (event.key.startsWith('Arrow')) { event.preventDefault(); const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest('[data-item-id]')?.getAttribute('data-item-id') : null; const index = Math.max(0, items.findIndex(item => item.id === (focused ?? selection.at(-1)))); const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'ArrowRight' ? rows : -rows; const item = items[Math.max(0, Math.min(items.length - 1, index + delta))]; if (item) { grid.current?.querySelector<HTMLElement>(`[data-item-id="${item.id}"]`)?.focus(); if (!event.ctrlKey) { const a = Math.max(0, items.findIndex(value => value.id === anchor.current)); const b = items.findIndex(value => value.id === item.id); setSelection(event.shiftKey ? items.slice(Math.min(a, b), Math.max(a, b) + 1).map(value => value.id) : [item.id]); if (!event.shiftKey) anchor.current = item.id } } }
    }} onPointerDown={event => {
      if (event.button !== 0 || event.target !== event.currentTarget) return
      grid.current?.focus(); setSelection(event.ctrlKey ? selection : []); useShellStore.getState().setStart(false)
      rubber.current = { x: event.clientX, y: event.clientY, initial: [...selection], ctrl: event.ctrlKey }
      event.currentTarget.setPointerCapture(event.pointerId)
    }} onDragOver={event => {
      if (useShellStore.getState().dragIds.length) event.preventDefault()
    }} onDrop={event => {
      const ids = useShellStore.getState().dragIds
      if (!ids.length) return
      event.preventDefault()
      const element = event.target instanceof Element ? event.target.closest('[data-item-id]') : null
      const target = items.find(item => item.id === element?.getAttribute('data-item-id'))
      if (target?.id === 'recycle') requestDelete(ids)
      else {
        const parent = target?.node?.kind === 'folder' ? target.node.id : desktopId
        const result = files.commit({ kind: event.ctrlKey ? 'copy' : 'move', ids, parent })
        if (!result.ok) showError(result.error)
      }
      useShellStore.getState().setDragIds([])
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
        const dropElement = document.elementsFromPoint(event.clientX, event.clientY).find(element => element.closest('.explorer-app'))
        const explorerElement = dropElement?.closest<HTMLElement>('.explorer-app')
        const explorerSession = explorerElement?.dataset.windowId ? useExplorerStore.getState().sessions[explorerElement.dataset.windowId] : null
        if (explorerSession) {
          const ids = start.ids.map(nodeId)
          if (explorerSession.location.kind === 'shell' && explorerSession.location.name === 'bin') requestDelete(ids)
          else {
            const folderId = dropElement?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId
            const folder = folderId ? files.nodes[nodeId(folderId)] : null
            const parent = folder?.kind === 'folder' ? folder.id : writableParent(explorerSession.location)
            if (parent) { const result = files.commit({ kind: event.ctrlKey ? 'copy' : 'move', ids, parent }); if (!result.ok) showError(result.error) }
          }
        } else if (target?.id === 'recycle') requestDelete(start.ids.flatMap(id => files.nodes[nodeId(id)] ? [nodeId(id)] : []))
        else if (target?.node?.kind === 'folder') {
          const result = files.commit({ kind: event.ctrlKey ? 'copy' : 'move', ids: start.ids.map(nodeId), parent: target.node.id })
          if (!result.ok) showError(result.error)
          else setSelection([target.id])
        } else {
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
      {preferences.show && items.map(item => <DesktopIcon key={item.id} item={item} selected={selection.includes(item.id)} position={positions[item.id]} size={preferences.size} rename={renameId === item.id} finishRename={() => { setRenameId(null); grid.current?.focus() }} dragging={false} cut={clipboard?.kind === 'cut' && clipboard.ids.includes(nodeId(item.id))} onClick={event => {
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
