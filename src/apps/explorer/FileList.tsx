import { useRef, useState, type PointerEvent } from 'react'
import { typeName } from '@/fs/paths'
import { nodeId, type Item } from '@/fs/types'
import { type ExplorerSession, useExplorerStore } from '@/stores/explorerStore'
import { requestDelete, showError } from '@/shell/DeleteDialog'
import { useShellStore } from '@/stores/shellStore'
import { writableParent } from '@/fs/paths'
import { useFilesStore } from '@/stores/filesStore'
import { ItemImage, RenameInput } from './FileItem'
const date = (value?: number) => value ? new Date(value).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', '') : ''
export const size = (bytes: number) => bytes > 0 ? `${Math.ceil(bytes / 1024)} KB` : ''
export default function FileList({ windowId, session, items, renameId, finishRename, activate, onContext, emptyText }: { windowId: string; session: ExplorerSession; items: Item[]; renameId: string | null; finishRename: () => void; activate: (item: Item) => void; onContext: (event: React.MouseEvent, item?: Item) => void; emptyText: string }) {
  const files = useFilesStore()
  const list = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; initial: string[]; ctrl: boolean } | null>(null)
  const [rectangle, setRectangle] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [focused, setFocused] = useState(false)
  const bin = session.location.kind === 'shell' && session.location.name === 'bin'
  const template = session.location.kind === 'library' ? session.location.library : session.location.kind === 'folder' ? files.nodes[session.location.id] : null
  const name = typeof template === 'string' ? template : template?.kind === 'folder' ? template.template : 'general'
  const columns: [string, number][] = bin ? [['Name', 220], ['Original Location', 220], ['Date Deleted', 160], ['Size', 90], ['Item type', 140], ['Date modified', 150]] : name === 'music' ? [['Name', 220], ['#', 36], ['Title', 180], ['Contributing artists', 150], ['Album', 150]] : name === 'pictures' ? [['Name', 240], ['Date', 150], ['Tags', 120], ['Size', 90], ['Rating', 100]] : [['Name', 240], ['Date modified', 150], ['Type', 150], ['Size', 90], ...(name === 'videos' ? [['Length', 90] as [string, number]] : [])]
  const [widths, setWidths] = useState<Record<string, number>>({})
  const patch = (selection: string[], anchor = session.anchor) => useExplorerStore.getState().patch(windowId, { selection, anchor })
  const select = (item: Item, ctrl: boolean, shift: boolean) => {
    if (shift && session.anchor) {
      const a = items.findIndex(value => value.id === session.anchor)
      const b = items.findIndex(value => value.id === item.id)
      const range = items.slice(Math.max(0, Math.min(a, b)), Math.max(a, b) + 1).map(value => value.id)
      patch(ctrl ? [...new Set([...session.selection, ...range])] : range)
    } else patch(ctrl ? session.selection.includes(item.id) ? session.selection.filter(id => id !== item.id) : [...session.selection, item.id] : [item.id], item.id)
  }
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target instanceof Element && event.target.closest('.file-item, .file-headers')) return
    list.current?.focus()
    const bounds = event.currentTarget.getBoundingClientRect()
    gesture.current = { x: event.clientX - bounds.left + event.currentTarget.scrollLeft, y: event.clientY - bounds.top + event.currentTarget.scrollTop, initial: [...session.selection], ctrl: event.ctrlKey || event.metaKey }
    if (!event.ctrlKey && !event.metaKey) patch([], null)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current
    if (!start) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left + event.currentTarget.scrollLeft
    const y = event.clientY - bounds.top + event.currentTarget.scrollTop
    if (Math.hypot(x - start.x, y - start.y) < 4) return
    const rect = { x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) }
    setRectangle(rect)
    const intersected = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('.file-item')).filter(element => {
      const item = element.getBoundingClientRect()
      const left = item.left - bounds.left + event.currentTarget.scrollLeft
      const top = item.top - bounds.top + event.currentTarget.scrollTop
      return left < rect.x + rect.width && left + item.width > rect.x && top < rect.y + rect.height && top + item.height > rect.y
    }).map(element => element.dataset.itemId!)
    patch(start.ctrl ? [...start.initial.filter(id => !intersected.includes(id)), ...intersected.filter(id => !start.initial.includes(id))] : intersected)
  }
  const end = () => { gesture.current = null; setRectangle(null) }
  const metadata = (item: Item, column: string) => {
    const node = item.node
    if (!node) return ''
    const entry = files.bin[node.id]
    if (column === 'Original Location') return entry?.originalLocation
    if (column === 'Date Deleted') return date(entry?.deletedAt)
    if (column === 'Date modified' || column === 'Date') return date(node.modifiedAt)
    if (column === 'Type' || column === 'Item type') return typeName(node)
    if (column === 'Size') return node.kind === 'file' ? size(node.bytes) : ''
    if (column === 'Title') return node.kind === 'file' ? item.name : ''
    return ''
  }
  return <div ref={list} className={`file-list view-${session.view}`} role="listbox" aria-label="Files" aria-multiselectable="true" data-focused={focused} tabIndex={0} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDragOver={event => { if (useShellStore.getState().dragIds.length) event.preventDefault() }} onDrop={event => {
    const ids = useShellStore.getState().dragIds
    if (!ids.length) return
    event.preventDefault()
    if (bin) requestDelete(ids)
    else {
      const element = event.target instanceof Element ? event.target.closest('[data-item-id]') : null
      const target = items.find(item => item.id === element?.getAttribute('data-item-id'))
      const parent = target?.node?.kind === 'folder' ? target.node.id : writableParent(session.location)
      if (parent) { const result = files.commit({ kind: event.ctrlKey ? 'copy' : 'move', ids, parent }); if (!result.ok) showError(result.error) }
    }
    useShellStore.getState().setDragIds([])
  }} onContextMenu={event => onContext(event)} onKeyDown={event => {
    if (event.target instanceof HTMLInputElement) return
    if (event.key === 'Escape') end()
    if (event.ctrlKey && event.key.toLowerCase() === 'a') { event.preventDefault(); event.stopPropagation(); patch(items.map(item => item.id), items[0]?.id ?? null) }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation()
      const last = session.selection.at(-1) ?? session.anchor
      const index = items.findIndex(item => item.id === last)
      const count = session.view === 'large' ? Math.max(1, Math.floor((event.currentTarget.clientWidth - 8) / 116)) : session.view === 'tiles' ? Math.max(1, Math.floor((event.currentTarget.clientWidth - 8) / 256)) : 1
      const delta = event.key === 'ArrowUp' ? -count : event.key === 'ArrowDown' ? count : event.key === 'ArrowLeft' ? -1 : 1
      const item = items[Math.max(0, Math.min(items.length - 1, index < 0 ? 0 : index + delta))]
      if (item) { if (event.ctrlKey) useExplorerStore.getState().patch(windowId, { anchor: item.id }); else select(item, false, event.shiftKey); event.currentTarget.querySelector<HTMLElement>(`[data-item-id="${item.id}"]`)?.scrollIntoView({ block: 'nearest' }) }
    }
  }}>
  {session.view === 'details' && <div className="file-headers" role="row" style={{ gridTemplateColumns: columns.map(([column, width]) => `${widths[column] ?? width}px`).join(' ') }}>{columns.map(([column, width]) => <div className="file-header" key={column}><button className="shell-button" onClick={() => useExplorerStore.getState().patch(windowId, { sort: { field: column, descending: session.sort.field === column && !session.sort.descending } })}>{session.sort.field === column && <span className="sort-arrow">{session.sort.descending ? '▾' : '▴'}</span>}{column}</button><span className="column-resize" onPointerDown={event => {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
    const start = event.clientX; const initial = widths[column] ?? width
    const element = event.currentTarget
    const update = (move: globalThis.PointerEvent) => setWidths(current => ({ ...current, [column]: Math.max(36, initial + move.clientX - start) }))
    const stop = () => { element.removeEventListener('pointermove', update); element.removeEventListener('pointerup', stop) }
    element.addEventListener('pointermove', update); element.addEventListener('pointerup', stop, { once: true })
  }} /></div>)}</div>}
  {session.location.kind === 'shell' && session.location.name === 'computer' ? <div className="computer-content">{items.map((item, index) => <div key={item.id}><div className="drive-group"><span>{index === 0 ? 'Hard Disk Drives (1)' : 'Devices with Removable Storage (1)'}</span></div><div className="file-item drive-tile" role="option" aria-label={item.name} tabIndex={-1} aria-selected={session.selection.includes(item.id)} data-item-id={item.id} onClick={event => select(item, event.ctrlKey, event.shiftKey)} onDoubleClick={() => activate(item)}><ItemImage item={item} /><span>{item.name}</span>{index === 0 && <><div className="capacity-bar"><div /></div><small>60.0 GB free of 100 GB</small></>}</div></div>)}</div> : <div className="file-items">{items.map(item => <div key={item.id} className="file-item" draggable={Boolean(item.node && !item.node.protected && !bin && renameId !== item.id)} onDragStart={event => {
    if (!item.node || item.node.protected || bin) { event.preventDefault(); return }
    const ids = (session.selection.includes(item.id) ? session.selection : [item.id]).map(nodeId)
    if (ids.some(id => !files.nodes[id] || files.nodes[id].protected)) { event.preventDefault(); return }
    useShellStore.getState().setDragIds(ids)
    event.dataTransfer.setData('application/x-computer-nodes', JSON.stringify(ids))
    event.dataTransfer.effectAllowed = 'copyMove'
  }} onDragEnd={() => useShellStore.getState().setDragIds([])} role="option" aria-label={item.name} tabIndex={-1} aria-selected={session.selection.includes(item.id)} data-item-id={item.id} style={session.view === 'details' ? { gridTemplateColumns: columns.map(([column, width]) => `${widths[column] ?? width}px`).join(' ') } : undefined} onClick={event => { list.current?.focus(); select(item, event.ctrlKey || event.metaKey, event.shiftKey) }} onDoubleClick={() => activate(item)} onContextMenu={event => { event.stopPropagation(); if (!session.selection.includes(item.id)) patch([item.id], item.id); onContext(event, item) }}>
    <div className="file-name"><ItemImage item={item} large={session.view === 'large'} />{renameId === item.id ? <RenameInput item={item} finish={finishRename} /> : <span>{item.name}</span>}</div>{session.view === 'details' && columns.slice(1).map(([column]) => <span className="file-metadata" key={column}>{metadata(item, column)}</span>)}{session.view === 'tiles' && item.node && <span className="tile-metadata">{typeName(item.node)}{item.node.kind === 'file' && <><br />{size(item.node.bytes)}</>}</span>}
  </div>)}</div>}
  {!items.length && <div className={`empty-folder${session.query ? ' search-empty' : ''}`}>{emptyText}</div>}{rectangle && <div className="rubber-band" style={{ left: rectangle.x, top: rectangle.y, width: rectangle.width, height: rectangle.height }} />}
  </div>
}
