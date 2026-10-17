import { useEffect, useRef, useState } from 'react'
import { ancestors, inBin, itemsAt, natural, typeName, writableParent } from '@/fs/paths'
import { type Item } from '@/fs/types'
import { play } from '@/lib/sound'
import { useExplorerStore } from '@/stores/explorerStore'
import { useFilesStore } from '@/stores/filesStore'
import { useWindows } from '@/stores/windows'
import ContextMenu, { type MenuEntry } from '@/shell/ContextMenu'
import { requestDelete, restoreItems, showError, useFileDialog } from '@/shell/DeleteDialog'
import NavigationBar from './NavigationBar'
import NavigationPane from './NavigationPane'
import CommandBar from './CommandBar'
import FileList from './FileList'
import DetailsPane from './DetailsPane'
import { binItems } from './RecycleBin'
import './explorer.css'
export default function Explorer({ windowId }: { windowId: string }) {
  const session = useExplorerStore(state => state.sessions[windowId])
  const recent = useExplorerStore(state => state.recent)
  const files = useFilesStore()
  const panel = useRef<HTMLDivElement>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [details, setDetails] = useState(true)
  const [navigation, setNavigation] = useState(true)
  const [paneWidth, setPaneWidth] = useState(182)
  const [menuBar, setMenuBar] = useState(false)
  const [query, setQuery] = useState('')
  const priorQuery = useRef('')
  const priorSelection = useRef<string[]>([])
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  useEffect(() => { const timer = setTimeout(() => setQuery(session?.query ?? ''), 200); return () => clearTimeout(timer) }, [session?.query])
  useEffect(() => {
    if (!session || session.location.kind !== 'folder') return
    if (!files.nodes[session.location.id] || inBin(files, session.location.id)) useExplorerStore.getState().navigate(windowId, { kind: 'shell', name: 'computer' })
  }, [files, session, windowId])
  useEffect(() => {
    if (!session) return
    if (session.query && !priorQuery.current) priorSelection.current = [...session.selection]
    const candidates = !session.query && priorQuery.current ? priorSelection.current : session.selection
    priorQuery.current = session.query
    const visible = new Set(itemsAt(files, session.location, recent).map(item => item.id))
    const selection = candidates.filter(id => visible.has(id) || session.query && files.nodes[id as keyof typeof files.nodes] && !inBin(files, files.nodes[id as keyof typeof files.nodes].id))
    if (JSON.stringify(selection) !== JSON.stringify(session.selection)) useExplorerStore.getState().patch(windowId, { selection })
  }, [files.nodes, files.bin, session, recent, windowId])
  if (!session) return null
  const bin = session.location.kind === 'shell' && session.location.name === 'bin'
  let items = bin ? binItems(files) : itemsAt(files, session.location, recent)
  if (query) {
    const roots = new Set(items.map(item => item.id))
    const descendants = Object.values(files.nodes).filter(node => !node.hidden && !inBin(files, node.id) && ancestors(files, node.id).some(parent => roots.has(parent.id)))
    items = bin ? items.filter(item => item.name.toLowerCase().includes(query.toLowerCase())) : descendants.filter(node => node.name.toLowerCase().includes(query.toLowerCase())).map(node => ({ id: node.id, name: node.kind === 'file' ? node.name.replace(/\.[^.]+$/, '') : node.name, icon: node.icon, node, location: node.kind === 'folder' ? { kind: 'folder', id: node.id } : undefined }))
  }
  items = [...items].sort((a, b) => {
    const first = a.node; const second = b.node
    let order = 0
    if (session.sort.field === 'Name') { const folders = Number(Boolean(second?.kind === 'folder' || b.location)) - Number(Boolean(first?.kind === 'folder' || a.location)); if (folders) return folders; order = natural(a.name, b.name) }
    else if (session.sort.field === 'Size') order = (first?.kind === 'file' ? first.bytes : 0) - (second?.kind === 'file' ? second.bytes : 0)
    else if (session.sort.field === 'Date Deleted') order = (first ? files.bin[first.id]?.deletedAt ?? 0 : 0) - (second ? files.bin[second.id]?.deletedAt ?? 0 : 0)
    else if (session.sort.field.startsWith('Date')) order = (first?.modifiedAt ?? 0) - (second?.modifiedAt ?? 0)
    else if (session.sort.field === 'Original Location') order = natural(first ? files.bin[first.id]?.originalLocation ?? '' : '', second ? files.bin[second.id]?.originalLocation ?? '' : '')
    else order = natural(first ? typeName(first) : '', second ? typeName(second) : '')
    return (order || natural(a.name, b.name)) * (session.sort.descending ? -1 : 1)
  })
  const selected = items.filter(item => session.selection.includes(item.id))
  const focusList = () => panel.current?.querySelector<HTMLElement>('.file-list')?.focus()
  const createFolder = () => {
    const parent = writableParent(session.location)
    if (!parent) return
    const result = files.commit({ kind: 'createFolder', parent })
    if (!result.ok) { showError(result.error); return }
    if (result.value) { useExplorerStore.getState().patch(windowId, { selection: [result.value], anchor: result.value }); setRenameId(result.value); setTimeout(() => panel.current?.querySelector('.rename-input')?.scrollIntoView({ block: 'nearest' }), 0) }
  }
  const rename = () => { if (selected.length === 1 && selected[0].node && !selected[0].node.protected && !bin) setRenameId(selected[0].id); else void play('ding') }
  const remove = (permanent = false) => {
    if (selected.some(item => !item.node || item.node.protected)) { void play('ding'); return }
    requestDelete(selected.flatMap(item => item.node ? [item.node.id] : []), permanent || bin)
  }
  const activate = (item: Item) => {
    if (bin && item.node) { useFileDialog.getState().show({ kind: 'error', title: `${item.node.name} Properties`, text: `${item.node.name}\n${typeName(item.node)}`, icon: item.node.icon }); return }
    if (item.location) useExplorerStore.getState().navigate(windowId, item.location)
    else if (item.id === 'dvd') useFileDialog.getState().show({ kind: 'error', title: 'DVD RW Drive (D:)', text: 'Please insert a disc into drive D:.', button: 'Cancel', icon: 'driveDvd' })
  }
  const context = (event: React.MouseEvent, item?: Item) => {
    event.preventDefault()
    const selection = item && !session.selection.includes(item.id) ? [item] : selected
    const protectedItem = selection.some(entry => !entry.node || entry.node.protected)
    const entries: MenuEntry[] = item ? bin ? [{ label: 'Restore', action: () => restoreItems(selection.flatMap(entry => entry.node ? [entry.node.id] : [])) }, { separator: true }, { label: 'Cut' }, { label: 'Delete', action: () => requestDelete(selection.flatMap(entry => entry.node ? [entry.node.id] : []), true) }, { separator: true }, { label: 'Properties' }] : [{ label: 'Open', action: item.location ? () => activate(item) : undefined }, { label: 'Open in new window', action: item.location ? () => useWindows.getState().open('explorer', item.location) : undefined }, { separator: true }, { label: 'Cut' }, { label: 'Copy' }, { separator: true }, { label: 'Create shortcut' }, { label: 'Delete', action: protectedItem ? undefined : () => requestDelete(selection.flatMap(entry => entry.node ? [entry.node.id] : [])) }, { label: 'Rename', action: !protectedItem && selection.length === 1 ? () => setRenameId(item.id) : undefined }, { separator: true }, { label: 'Properties' }] : [{ label: 'Details', action: () => useExplorerStore.getState().patch(windowId, { view: 'details' }), checked: session.view === 'details' }, { label: 'Large icons', action: () => useExplorerStore.getState().patch(windowId, { view: 'large' }), checked: session.view === 'large' }, { separator: true }, { label: 'Refresh', action: () => useExplorerStore.getState().refresh(windowId) }, { separator: true }, { label: 'New folder', action: writableParent(session.location) ? createFolder : undefined }, { label: 'Properties' }]
    setMenu({ x: event.clientX, y: event.clientY, entries })
  }
  let emptyText = query ? 'No items match your search.' : 'This folder is empty.'
  if (session.location.kind === 'shell' && session.location.name === 'homegroup') emptyText = 'No other homegroup computers are currently available.'
  if (session.location.kind === 'shell' && session.location.name === 'network') emptyText = 'No computers found.'
  return <div ref={panel} className="explorer-app" data-window-id={windowId} onKeyDown={event => {
    if (useFileDialog.getState().request || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    if (event.key === 'Alt') { event.preventDefault(); setMenuBar(!menuBar); return }
    if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); useExplorerStore.getState().back(windowId) }
    else if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); useExplorerStore.getState().forward(windowId) }
    else if (event.key === 'Backspace') { event.preventDefault(); useExplorerStore.getState().up(windowId) }
    else if (event.key === 'F5') { event.preventDefault(); useExplorerStore.getState().refresh(windowId) }
    else if (event.key === 'F2') { event.preventDefault(); rename() }
    else if (event.key === 'Delete') { event.preventDefault(); remove(event.shiftKey) }
    else if (event.key === 'Enter' && event.target instanceof Element && event.target.closest('.file-list')) { event.preventDefault(); for (const item of selected) activate(item) }
    else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); createFolder() }
    else if (event.key === 'F10' && event.shiftKey || event.key === 'ContextMenu') { event.preventDefault(); const rect = panel.current?.querySelector('.file-item[aria-selected=true]')?.getBoundingClientRect() ?? panel.current!.getBoundingClientRect(); context({ preventDefault() {}, clientX: rect.left + 20, clientY: rect.top + 20 } as React.MouseEvent, selected[0]) }
  }}>
    {menuBar && <div className="explorer-menubar">{['File', 'Edit', 'View', 'Tools', 'Help'].map(label => <button className="shell-button" key={label} disabled>{label}</button>)}</div>}
    <NavigationBar windowId={windowId} session={session} /><CommandBar windowId={windowId} session={session} createFolder={createFolder} rename={rename} remove={() => remove()} details={details} setDetails={setDetails} navigation={navigation} setNavigation={setNavigation} />
    <div className="explorer-middle">{navigation && <div className="navigation-container" style={{ width: paneWidth }}><NavigationPane windowId={windowId} location={session.location} /><div className="pane-divider" onPointerDown={event => {
      event.currentTarget.setPointerCapture(event.pointerId)
      const start = event.clientX; const initial = paneWidth; const element = event.currentTarget
      const move = (pointer: PointerEvent) => setPaneWidth(Math.max(120, Math.min(320, initial + pointer.clientX - start)))
      const stop = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', stop) }
      element.addEventListener('pointermove', move); element.addEventListener('pointerup', stop, { once: true })
    }} /></div>}<FileList windowId={windowId} session={session} items={items} renameId={renameId} finishRename={() => { setRenameId(null); focusList() }} activate={activate} onContext={context} emptyText={emptyText} /></div>
    {details && <DetailsPane items={items} selected={selected} />}{menu && <ContextMenu {...menu} close={() => { setMenu(null); focusList() }} />}
  </div>
}
